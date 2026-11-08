"""Banana English Live Talk captions (CC).

Joins a Live Talk room when the API dispatches it, transcribes ONLY the
host's microphone (English, LiveKit Inference STT) and publishes captions
to everyone in the room as data packets on topic "caption":

    {"id": "<segment id>", "spk": "<speaker identity>", "t": "<text>", "f": true|false}

Interim packets (f=false) are lossy and replace each other; the final packet
(f=true) closes the segment. Leaves when the host has been gone for a while.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    AgentServer,
    AutoSubscribe,
    JobContext,
    cli,
    inference,
    stt,
)

load_dotenv(".env.local")

logger = logging.getLogger("banana-captions")

AGENT_NAME = "banana-captions"
TOPIC = "caption"
STT_MODEL = "assemblyai/universal-streaming"
INTERIM_EVERY_S = 0.2
# The app reconnects (new token) on some role changes; don't leave on a blip.
HOST_GONE_GRACE_S = 45

server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    try:
        meta = json.loads(ctx.job.metadata or "{}")
    except (TypeError, ValueError):
        meta = {}
    speaker_ids: set[str] = {str(i) for i in (meta.get("speakerIds") or []) if i}
    if meta.get("hostId"):
        speaker_ids.add(str(meta["hostId"]))
    if not speaker_ids:
        logger.warning("no hostId in job metadata; nothing to caption")
        return

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_NONE)
    room = ctx.room
    logger.info("captioning %s in %s", sorted(speaker_ids), room.name)

    tasks: dict[str, asyncio.Task] = {}  # track sid -> transcribe task
    leave_timer: asyncio.Task | None = None

    async def publish(payload: dict, reliable: bool) -> None:
        try:
            await room.local_participant.publish_data(
                json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                reliable=reliable,
                topic=TOPIC,
            )
        except Exception:  # noqa: BLE001 - captions are best effort
            logger.exception("publish caption failed")

    async def transcribe(track: rtc.Track, identity: str) -> None:
        engine = inference.STT(model=STT_MODEL, language="en")
        stream = engine.stream()
        audio = rtc.AudioStream(track, sample_rate=16000, num_channels=1)

        async def pump() -> None:
            async for event in audio:
                stream.push_frame(event.frame)
            stream.end_input()

        pump_task = asyncio.create_task(pump())
        segment = uuid.uuid4().hex[:10]
        last_interim = 0.0
        try:
            async for ev in stream:
                if ev.type not in (
                    stt.SpeechEventType.INTERIM_TRANSCRIPT,
                    stt.SpeechEventType.FINAL_TRANSCRIPT,
                ):
                    continue
                text = ev.alternatives[0].text.strip() if ev.alternatives else ""
                if not text:
                    continue
                final = ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT
                now = time.monotonic()
                if not final and now - last_interim < INTERIM_EVERY_S:
                    continue
                last_interim = now
                await publish(
                    {"id": segment, "spk": identity, "t": text[:500], "f": final},
                    reliable=final,
                )
                if final:
                    segment = uuid.uuid4().hex[:10]
        finally:
            pump_task.cancel()
            await stream.aclose()
            await audio.aclose()

    def start(
        track: rtc.Track,
        pub: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        sid = pub.sid
        if sid in tasks:
            return
        tasks[sid] = asyncio.create_task(transcribe(track, participant.identity))

    def stop(sid: str) -> None:
        task = tasks.pop(sid, None)
        if task:
            task.cancel()

    def wants(participant: rtc.RemoteParticipant, pub: rtc.RemoteTrackPublication) -> bool:
        return participant.identity in speaker_ids and pub.kind == rtc.TrackKind.KIND_AUDIO

    def host_here() -> bool:
        return any(p.identity in speaker_ids for p in room.remote_participants.values())

    async def leave_later() -> None:
        await asyncio.sleep(HOST_GONE_GRACE_S)
        if not host_here():
            logger.info("host gone, leaving %s", room.name)
            ctx.shutdown(reason="host left")

    def arm_leave_timer() -> None:
        nonlocal leave_timer
        if leave_timer is None or leave_timer.done():
            leave_timer = asyncio.create_task(leave_later())

    @room.on("track_published")
    def _on_published(pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        if wants(participant, pub):
            pub.set_subscribed(True)

    @room.on("track_subscribed")
    def _on_subscribed(
        track: rtc.Track,
        pub: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if wants(participant, pub):
            start(track, pub, participant)

    @room.on("track_unsubscribed")
    def _on_unsubscribed(track, pub: rtc.RemoteTrackPublication, participant) -> None:  # noqa: ANN001
        stop(pub.sid)

    @room.on("participant_disconnected")
    def _on_left(participant: rtc.RemoteParticipant) -> None:
        if participant.identity in speaker_ids and not host_here():
            arm_leave_timer()

    # Host may already be in the room with the mic published.
    for participant in room.remote_participants.values():
        for pub in participant.track_publications.values():
            if wants(participant, pub):
                pub.set_subscribed(True)
                if pub.track is not None:
                    start(pub.track, pub, participant)
    if not host_here():
        arm_leave_timer()

    async def cleanup() -> None:
        for sid in list(tasks):
            stop(sid)

    ctx.add_shutdown_callback(cleanup)


if __name__ == "__main__":
    cli.run_app(server)
