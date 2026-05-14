import fs from 'fs';
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const port = process.env.PORT || 3001;
const recaptchaSecret = process.env.RECAPTCHA_SECRET;

// JWT secret
const random = crypto.randomBytes(64).toString('hex');

// ---------- HELPERS ----------

function signJWT(val) {
    return jwt.sign(val, random, {
        expiresIn: '1h'
    });
}

function verifyJWT(token) {
    try {
        return jwt.verify(token, random);
    } catch {
        return null;
    }
}

function getMatchKey(a, b) {
    return [a, b].sort().join("__");
}

// ---------- DATABASE ----------

if (!fs.existsSync('/data')) {
    fs.mkdirSync('/data');
}

if (!fs.existsSync('/data/db.json')) {
    fs.writeFileSync('/data/db.json', JSON.stringify({}));
}

// load db into memory once
let db = JSON.parse(
    fs.readFileSync('/data/db.json')
);

function get(item) {
    return db[item] || 0;
}

async function set(item, value) {
    db[item] = value;

    await fs.promises.writeFile(
        '/data/db.json',
        JSON.stringify(db)
    );
}

// ---------- DATA ----------

const things = [
    // your items here
];

// single-use JWT ids
const activeJWTS = new Set();

// ---------- CORS ----------

app.options("/random", (req, res) => {
    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET'
    );

    res.send();
});

app.options("/:choice", (req, res) => {
    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        'POST'
    );

    res.header(
        'Access-Control-Allow-Headers',
        'Captcha-Response, Token'
    );

    res.send();
});

app.options("/results", (req, res) => {
    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET'
    );

    res.send();
});

// ---------- STATIC ----------

app.use(express.static('images'));

// ---------- ROUTES ----------

app.get("/", (req, res) => {
    res.send("Hello World!");
});

// random matchup
app.get("/random", (req, res) => {

    let item1 =
        things[Math.floor(Math.random() * things.length)];

    let item2 =
        things[Math.floor(Math.random() * things.length)];

    while (item1 === item2) {
        item2 =
            things[Math.floor(Math.random() * things.length)];
    }

    const id =
        crypto.randomBytes(7).toString('hex');

    activeJWTS.add(id);

    const token = signJWT({
        options: [item1, item2],
        jti: id
    });

    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET'
    );

    res.contentType('text/plain');

    res.send(token);
});

// global rankings
app.get("/results", async (req, res) => {

    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET'
    );

    const results = [];

    for (const thing of things) {

        const votes = get(thing) || 0;

        const games =
            get(`${thing}-games`) || 0;

        const percentage =
            games > 0
                ? Math.round((votes / games) * 100)
                : 0;

        results.push({
            thing,
            votes,
            games,
            percentage
        });
    }

    results.sort(
        (a, b) => b.percentage - a.percentage
    );

    res.json(results);
});

// vote endpoint
app.post("/:choice", async (req, res) => {

    res.header(
        'Access-Control-Allow-Origin',
        process.env.ORIGIN
    );

    res.header(
        'Access-Control-Allow-Methods',
        'POST'
    );

    res.header(
        'Access-Control-Allow-Headers',
        'Captcha-Response, Token'
    );

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

    if (
        !verified.jti ||
        !activeJWTS.has(verified.jti)
    ) {
        return res.status(400).json({
            error: "JWT expired or already used"
        });
    }

    const options = verified.options;

    if (!options) {
        return res.status(400).json({
            error: "JWT missing options"
        });
    }

    if (!options.includes(choice)) {
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

    // only count valid captcha scores
    if (captchaData.score > 0.5) {

        // winner votes
        const winnerVotes =
            get(choice) || 0;

        await set(
            choice,
            winnerVotes + 1
        );

        // games played
        const winnerGames =
            get(`${choice}-games`) || 0;

        const loserGames =
            get(`${other}-games`) || 0;

        await set(
            `${choice}-games`,
            winnerGames + 1
        );

        await set(
            `${other}-games`,
            loserGames + 1
        );

        // matchup tracking
        const key =
            getMatchKey(choice, other);

        const matchup =
            get(`matchup-${key}`) || {
                [choice]: 0,
                [other]: 0
            };

        matchup[choice] =
            (matchup[choice] || 0) + 1;

        await set(
            `matchup-${key}`,
            matchup
        );

        // invalidate token
        activeJWTS.delete(
            verified.jti
        );
    }

    // return matchup percentages
    const key =
        getMatchKey(choice, other);

    const matchup =
        get(`matchup-${key}`) || {
            [choice]: 0,
            [other]: 0
        };

    const chosenVotes =
        matchup[choice] || 0;

    const otherVotes =
        matchup[other] || 0;

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

    res.send([
        chosenPercentage,
        otherPercentage
    ]);
});

app.listen(port, () => {
    console.log(
        `Server running on port ${port}`
    );
});
