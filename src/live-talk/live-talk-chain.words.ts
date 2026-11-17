/**
 * Word Chain (Live Talk): words the system counts on its own — everyday
 * A1/A2 nouns, verbs and adjectives, base forms only (no plurals, so "cats"
 * does not dodge the letter). Anything else waits for the host's "นับให้".
 * Filler-ish words (see, say, well, very, …) are left out on purpose: they
 * come up in "let me see…" before the real answer.
 */
const RAW = `
able accident act action activity actor address adult adventure advice aeroplane afraid
afternoon age agree air airport alarm album alive alphabet amazing ambulance anger angry animal
ankle answer ant apartment apple april area argue arm armchair army arrive arrow art artist
asleep attack attention august aunt autumn avocado awake awful baby back backpack bad bag bake
bakery ball balloon banana band bank barbecue baseball basket basketball bat bath bathroom beach
bean bear beard beautiful bed bedroom bee beef begin behind believe bell belt bench best better
bicycle big bike bill bird birthday biscuit bite black blackboard blanket blind block blonde
blood blouse blue board boat body boil bone book bookshop boot bored boring born borrow boss
bottle bottom bowl box boy brain branch brave bread break breakfast bridge bright bring broom
brother brown brush bubble bucket buffalo build building burger burn bus business busy butter
butterfly button buy cabbage cafe cage cake calendar call calm camel camera camp candle candy
cap capital car card care careful carpet carrot carry cartoon castle cat catch cave ceiling
celebrate cent centre chair chalk change channel character cheap check cheek cheese chef cherry
chess chicken child chin chip chocolate choose chopsticks church cinema circle city clap class
classroom clean clear clever climb clock close cloth clothes cloud cloudy clown club coat
coconut coffee coin cold collect college colour comb come comic computer cook cookie cool copy
corn corner correct cost cotton cough count country cousin cow crab crayon crazy cream cross
crowd crown cry cucumber cup cupboard curtain customer cut cute cycle dad daily dance dancer
danger dangerous dark date daughter day dead deaf dear december decide deep deer delicious
dentist desert design desk dessert diary dice dictionary die different difficult dinner dinosaur
dirty discover dish dive doctor dog doll dollar dolphin donkey door double down download dragon
draw drawer drawing dream dress drill drink drive driver drop drum dry duck dust duty eagle ear
early earn earth east easy eat edge egg eight elbow electric elephant elevator eleven email
empty end energy engineer english enjoy enter envelope eraser escape evening event exam example
excellent excited exciting exercise exit expensive explain eye eyebrow face factory fairy fall
false family famous fan far farm farmer fashion fast fat father favourite fear february feed
feel fence festival fever field fifteen fifty fight fill film find finger finish fire fireman
fish fisherman fit five fix flag flat flight float floor flower flu fly fog fold follow food
foot football forest forget fork forty four fox frame free fresh friday fridge friend friendly
frog fruit frying full fun funny furniture future game garage garden garlic gate gentle ghost
giant gift giraffe girl give glad glass glasses glove glue go goal goat gold golf good goose
gorilla grab grandfather grandma grandmother grandpa grape grass gray great green grey ground
group grow guest guitar gym hair haircut half hall ham hamburger hammer hand handbag happy hard
hat hate head headache health healthy hear heart heavy helicopter help hen hide high hill hippo
history hit hobby hold hole holiday home homework honest honey hope horn horse hospital hot
hotel hour house hungry hurry hurt husband ice idea ill important ink insect inside internet
invite iron island jacket jam january jar jeans jelly job join joke journey juice july jump
jumper june jungle kangaroo key keyboard kick kid kill kind king kiss kitchen kite kitten knee
knife knock koala lake lamp land language laptop large late laugh lazy leaf learn leave left leg
lemon lemonade leopard lesson letter lettuce library lie lift light lion lip list listen little
live living lizard lock long look lose loud love lovely low lucky lunch machine mad magazine
magic mail make man mango many map march market married mask match maths meal meat medicine meet
melon menu message metal middle milk minute mirror miss mistake mix mobile monday money monkey
month moon morning mosquito mother motorbike mountain mouse moustache mouth move movie mug
museum mushroom music musician nail name narrow nature near neck necklace need neighbour nephew
nervous nest net new news newspaper next nice niece night nine noise noisy noodle noon north
nose note notebook november number nurse nut ocean october octopus office oil old onion open
orange order ostrich outside oven owl own paint painter painting pair pajamas palace pan panda
paper parent park parrot party pass passport past pasta path pay pea peach pear pen pencil
penguin people pepper person pet phone photo piano pick picnic picture pie piece pig pillow
pilot pin pineapple pink pizza place plan plane planet plant plate play player playground pocket
poem police policeman polite pond pool poor popcorn popular post postcard poster pot potato
practice present pretty price prince princess prize problem pull pumpkin pupil puppy purple
purse push puzzle queen question quick quiet quiz rabbit race radio rain rainbow rainy read
ready red relax remember rent repeat rest restaurant rice rich ride right ring river road robot
rock rocket roof room rope rose round rubber rug rule ruler run sad safe salad sale salt same
sand sandwich saturday sausage save scarf school science scissors score sea seat second sell
send sentence september seven shape share shark sheep shelf shell ship shirt shoe shop shopping
short shorts shoulder shout show shower shy sick sign silver sing singer sink sister sit six
skate skirt sky sleep slow small smart smell smile snack snake snow soap sock sofa soft soldier
son song soup south space speak spell spend spider spoon sport spring square stamp stand star
start station stay steak stomach stone stop store storm story strawberry street strong student
study subject sugar summer sun sunday sunny supermarket surprise swan sweater sweet swim
swimming table tablet tail take talk tall taxi tea teach teacher team teddy teeth telephone
television temple ten tennis tent test text thin thing thirsty three throw thumb thursday ticket
tidy tie tiger time tired toast today toe together toilet tomato tomorrow tongue tooth
toothbrush top touch towel tower town toy traffic train travel tree trip trousers truck true try
tuesday turn turtle twelve twenty two ugly umbrella uncle under understand uniform university
upstairs use useful vacation van vase vegetable video village violin visit voice volleyball wait
waiter wake walk wall wallet want warm wash watch water watermelon wave weak wear weather
wedding wednesday week weekend welcome west wet whale wheel white wide wife wild win wind window
windy wine wing winter wish wolf woman wonderful wood wool word work world worm worry write
wrong yard year yellow yesterday yoghurt yogurt young zebra zero zoo
`;

export const CHAIN_WORDS: ReadonlySet<string> = new Set(RAW.split(/\s+/).filter(Boolean));
