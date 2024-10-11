import fs from 'fs';
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';


const random = crypto.randomBytes(64).toString('hex');

function signJWT(val) {
    return jwt.sign(val, random, { expiresIn: '1h' });
}
function verifyJWT(token) {
    try {
        return jwt.verify(token, random);
    } catch {
        return null;
    }
}

const app = express();
app.use(express.json());

const port = process.env.PORT || 3001;
const recaptchaSecret = "6Le2eV4qAAAAAGlnFHl7ARO0c5O7YdDpWm4kIlIT";
const things = [
    "apple",
    "bag",
    "balloon",
    "bananas",
    "bed",
    "beef",
    "blouse",
    "book",
    "bookmark",
    "boom box",
    "bottle",
    "bottle cap",
    "bow",
    "bowl",
    "box",
    "bracelet",
    "bread",
    "brocolli",
    "hair brush",
    "buckle",
    "button",
    "camera",
    "candle",
    "candy wrapper",
    "canvas",
    "car",
    "greeting card",
    "playing card",
    "carrots",
    "cat",
    "CD",
    "cell phone",
    "packing peanuts",
    "cinder block",
    "chair",
    "chalk",
    "newspaper",
    "soy sauce packet",
    "chapter book",
    "checkbook",
    "chocolate",
    "clay pot",
    "clock",
    "clothes",
    "computer",
    "conditioner",
    "cookie jar",
    "cork",
    "couch",
    "credit card",
    "cup",
    "deodorant",
    "desk",
    "door",
    "drawer",
    "drill press",
    "eraser",
    "eye liner",
    "face wash",
    "fake flowers",
    "flag",
    "floor",
    "flowers",
    "food",
    "fork",
    "fridge",
    "glass",
    "glasses",
    "glow stick",
    "grid paper",
    "hair tie",
    "hanger",
    "helmet",
    "house",
    "ipod",
    "charger",
    "key chain",
    "keyboard",
    "keys",
    "knife",
    "lace",
    "lamp",
    "lamp shade",
    "leg warmers",
    "lip gloss",
    "lotion",
    "milk",
    "mirror",
    "model car",
    "money",
    "monitor",
    "mop",
    "mouse pad",
    "mp3 player",
    "nail clippers",
    "nail file",
    "needle",
    "outlet",
    "paint brush",
    "pants",
    "paper",
    "pen",
    "pencil",
    "perfume",
    "phone",
    "photo album",
    "picture frame",
    "pillow",
    "plastic fork",
    "plate",
    "pool stick",
    "soda can",
    "puddle",
    "purse",
    "blanket",
    "radio",
    "remote",
    "ring",
    "rubber band",
    "rubber duck",
    "rug",
    "rusty nail",
    "sailboat",
    "sand paper",
    "sandal",
    "scotch tape",
    "screw",
    "seat belt",
    "shampoo",
    "sharpie",
    "shawl",
    "shirt",
    "shoe lace",
    "shoes",
    "shovel",
    "sidewalk",
    "sketch pad",
    "slipper",
    "soap",
    "socks",
    "sofa",
    "speakers",
    "sponge",
    "spoon",
    "spring",
    "sticky note",
    "stockings",
    "stop sign",
    "street lights",
    "sun glasses",
    "table",
    "teddies",
    "television",
    "thermometer",
    "thread",
    "tire swing",
    "tissue box",
    "toe ring",
    "toilet",
    "tomato",
    "tooth picks",
    "toothbrush",
    "toothpaste",
    "towel",
    "tree",
    "truck",
    "tv",
    "tweezers",
    "twister",
    "vase",
    "video games",
    "wallet",
    "washing machine",
    "watch",
    "water bottle",
    "doll",
    "magnet",
    "wagon",
    "headphones",
    "clamp",
    "USB drive",
    "air freshener",
    "piano",
    "ice cube tray",
    "white out",
    "window",
    "controller",
    "coasters",
    "thermostat",
    "zipper"
]

let queue = [];
const activeJWTS = new Set();


async function get(item) {
    const data = await fs.promises.readFile(`/data/db.json`);
    const json = JSON.parse(data);
    return json[item] || 0;
}

async function set(item, value) {
    const data = await fs.promises.readFile(`/data/db.json`);
    const json = JSON.parse(data);
    json[item] = value;
    await fs.promises.writeFile(`/data/db.json`, JSON.stringify(json));

}

//cors
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); //TODO: change to only allow certain origins
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
});

app.use(express.static('images'));

app.get("/random", (req, res) => {
    let item1 = things[Math.floor(Math.random() * things.length)];
    let item2 = things[Math.floor(Math.random() * things.length)];

    while (item1 === item2) {
        item2 = things[Math.floor(Math.random() * things.length)];
    }

    const id = crypto.randomBytes(64).toString('hex');
    activeJWTS.add(id);

    const jwt = signJWT({ options: [item1, item2], id });

    res.send([item1, item2, jwt]);

});

app.post("/choice", async (req, res) => {
    const { choice } = req.body;
    const captchaResponse = req.headers['captcha-response'];
    const jwt = req.headers['Authorization']?.split(" ")[1];

    if (!choice || !captchaResponse || !jwt) return res.status(400).json({ error: "Missing parameters" });

    const searchParams = new URLSearchParams();
    searchParams.append('secret', recaptchaSecret);
    searchParams.append('response', captchaResponse);

    const captchaRes = await fetch(`https://www.google.com/recaptcha/api/siteverify?${searchParams.toString()}`, {
        method: 'POST'
    });

    const captchaData = await captchaRes.json();

    if (!captchaData.success) {
        return res.status(400).json({ error: "Captcha response not ok" });
    }

    const verified = verifyJWT(jwt);
    if (!verified) return res.json({
        error: "JWT is signed incorrectly"
    })
    const data = verified?.options;
    if (!data) return res.json({
        error: "JWT parsed, but does not contain options"
    })

    if (!verified.id || !activeJWTS.has(verified.id)) return res.json({
        error: "JWT expired or invalid"
    })

    const other = data.find((item) => item !== choice);

    if (!data.includes(choice)) {
        return res.status(400).json({ error: "Item is not valid" });
    }
    if (!things.includes(choice)) {
        return res.status(400).json({ error: "Item does not exist" });
    }

    if (captchaData.score > 0.5) {
        queue.push({
            type: "choice",
            choice,
        });
        queue.push({
            type: "game",
            choice: other
        });
        await processQueue();
    }

    //get percentage of choices
    const chosenVotes = await get(choice);
    const otherVotes = await get(other);
    const chosenGames = await get(`${choice}-games`);
    const otherGames = await get(`${other}-games`);

    const chosenPercentage = Math.round((chosenVotes / chosenGames) * 100);
    const otherPercentage = Math.round((otherVotes / otherGames) * 100);


    res.send([chosenPercentage, otherPercentage]);

});

app.get("/results", async (req, res) => {
    let results = [];
    for (const thing of things) {
        const votes = await get(thing) || 0;
        const games = await get(`${thing}-games`) || 0;
        const percentage = Math.round((votes / games) * 100) || 0;
        results.push({ thing, votes, games, percentage });
    }

    //sort results by highest percentage
    results.sort((a, b) => b.percentage - a.percentage);
    res.json(results);
});

let processing = false;

async function processQueue() {
    //if already processing, wait untill done and return
    if (processing) {
        while (processing) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return;
    }
    processing = true;

    while (queue.length > 0) {
        const choice = queue.shift();

        if (choice.type === "choice") {
            const data = await get(choice.choice) || 0;
            await set(choice.choice, data + 1);
            const data2 = await get(`${choice.choice}-games`) || 0;
            await set(`${choice.choice}-games`, data2 + 1);
        }

        if (choice.type === "game") {
            const data2 = await get(`${choice.choice}-games`) || 0;
            await set(`${choice.choice}-games`, data2 + 1);
        }

    }

    processing = false;


}

if (!fs.existsSync('/data')) {
    fs.mkdirSync('/data');
}
if (!fs.existsSync('/data/db.json')) {
    fs.writeFileSync('/data/db.json', JSON.stringify({}));
}


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});