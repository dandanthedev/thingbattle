import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from 'redis';

const app = express();

app.use(express.json());

const port = process.env.PORT || 3001;
const recaptchaSecret = process.env.RECAPTCHA_SECRET;

// ---------- REDIS ----------

const redis = createClient({
    url: process.env.REDIS_URL
});

redis.on('error', err => {
    console.error('Redis error:', err);
});

await redis.connect();

// ---------- JWT ----------

const jwtSecret =
    crypto.randomBytes(64).toString('hex');

function signJWT(payload) {
    return jwt.sign(payload, jwtSecret, {
        expiresIn: '1h'
    });
}

function verifyJWT(token) {
    try {
        return jwt.verify(token, jwtSecret);
    } catch {
        return null;
    }
}

function getMatchKey(a, b) {
    return [a, b].sort().join("__");
}

// ---------- DATA ----------

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
];

// ---------- CORS ----------

function setCors(res, methods) {
    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        methods
    );

    res.header(
        'Access-Control-Allow-Headers',
        'Captcha-Response, Token'
    );
}

app.options("*", (req, res) => {
    setCors(res, 'GET, POST');
    res.send();
});

// ---------- STATIC ----------

app.use(express.static('images'));

// ---------- ROUTES ----------

app.get("/", (req, res) => {
    res.send("Hello World!");
});

// random matchup
app.get("/random", async (req, res) => {

    let item1 =
        things[Math.floor(Math.random() * things.length)];

    let item2 =
        things[Math.floor(Math.random() * things.length)];

    while (item1 === item2) {
        item2 =
            things[Math.floor(Math.random() * things.length)];
    }

    const jti =
        crypto.randomBytes(12).toString('hex');

    // store active token in redis
    await redis.setEx(
        `jwt:${jti}`,
        60 * 60,
        '1'
    );

    const token = signJWT({
        options: [item1, item2],
        jti
    });

    setCors(res, 'GET');

    res.contentType('text/plain');

    res.send(token);
});

// global rankings
app.get("/results", async (req, res) => {

    setCors(res, 'GET');

    const results = await Promise.all(
        things.map(async thing => {

            const [
                votes,
                games
            ] = await Promise.all([
                redis.get(`votes:${thing}`),
                redis.get(`games:${thing}`)
            ]);

            const voteCount =
                Number(votes || 0);

            const gameCount =
                Number(games || 0);

            return {
                thing,
                votes: voteCount,
                games: gameCount,
                percentage:
                    gameCount > 0
                        ? Math.round(
                            (voteCount / gameCount) * 100
                        )
                        : 0
            };
        })
    );

    results.sort(
        (a, b) => b.percentage - a.percentage
    );

    res.json(results);
});

// vote
app.post("/:choice", async (req, res) => {

    setCors(res, 'POST');

    const choice = req.params.choice;

    const captchaResponse =
        req.headers['captcha-response'];

    const token =
        req.headers['token'];

    if (
        !choice ||
        !captchaResponse ||
        !token
    ) {
        return res.status(400).json({
            error: "Missing parameters"
        });
    }

    // verify captcha
    const searchParams = new URLSearchParams();

    searchParams.append(
        'secret',
        recaptchaSecret
    );

    searchParams.append(
        'response',
        captchaResponse
    );

    const captchaRes = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?${searchParams.toString()}`,
        {
            method: 'POST'
        }
    );

    const captchaData =
        await captchaRes.json();

    if (!captchaData.success) {
        return res.status(400).json({
            error: "Captcha response not ok"
        });
    }

    // verify JWT
    const verified = verifyJWT(token);

    if (!verified) {
        return res.status(400).json({
            error: "JWT invalid"
        });
    }

    // check single-use token
    const tokenExists =
        await redis.del(`jwt:${verified.jti}`);

    if (!tokenExists) {
        return res.status(400).json({
            error: "JWT expired or already used"
        });
    }

    const options = verified.options;

    if (
        !options ||
        !options.includes(choice)
    ) {
        return res.status(400).json({
            error: "Invalid choice"
        });
    }

    if (!things.includes(choice)) {
        return res.status(400).json({
            error: "Choice does not exist"
        });
    }

    const other =
        options.find(item => item !== choice);

    // only count good captcha scores
    if (captchaData.score > 0.5) {

        const multi = redis.multi();

        // winner vote
        multi.incr(`votes:${choice}`);

        // games played
        multi.incr(`games:${choice}`);
        multi.incr(`games:${other}`);

        // matchup
        const matchupKey =
            getMatchKey(choice, other);

        multi.hIncrBy(
            `matchup:${matchupKey}`,
            choice,
            1
        );

        await multi.exec();
    }

    // matchup stats
    const matchupKey =
        getMatchKey(choice, other);

    const matchup =
        await redis.hGetAll(
            `matchup:${matchupKey}`
        );

    const chosenVotes =
        Number(matchup[choice] || 0);

    const otherVotes =
        Number(matchup[other] || 0);

    const total =
        chosenVotes + otherVotes;

    const chosenPercentage =
        total > 0
            ? Math.round(
                (chosenVotes / total) * 100
            )
            : 50;

    const otherPercentage =
        100 - chosenPercentage;

    res.json([
        chosenPercentage,
        otherPercentage
    ]);
});

app.listen(port, () => {
    console.log(
        `Server running on port ${port}`
    );
});
