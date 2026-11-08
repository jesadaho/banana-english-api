# Live Talk captions agent

Host-only English captions for Live Talk (LiveKit Cloud agent + LiveKit Inference STT).
Uses the same LiveKit project as the API — no new API keys.

## Deploy (once)

```bash
brew install livekit-cli          # if not installed
cd agents/live-talk-captions
lk cloud auth                      # log in in the browser
lk project set-default <project>   # the project the API's LIVEKIT_URL points to
lk agent create                    # uses this Dockerfile; writes livekit.toml
```

Update later: `lk agent deploy`. Logs: `lk agent logs`.

## Run locally (optional)

```bash
cp .env.example .env.local         # fill LIVEKIT_URL / KEY / SECRET
uv sync && uv run src/agent.py dev
```

## How it is used

- The API dispatches `banana-captions` when a room is created
  (`LIVE_TALK_CAPTIONS_AGENT`, default `banana-captions`; set `off` to disable).
- Job metadata: `{"hostId": "<user id>"}`. Only that identity's mic is transcribed.
- Captions go out as data packets, topic `caption`:
  `{"id","spk","t","f"}` (f = final).
- The agent leaves 45 s after the host disconnects.

Cost: ~1 agent minute + 1 STT minute per room minute (Build plan: 1,000 agent minutes).
