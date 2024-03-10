import fs from 'fs';
import sharp from 'sharp';

//load all images from images dir
const images = fs.readdirSync('./images');

if (!fs.existsSync('./images/l')) {
    fs.mkdirSync('./images/l');
}

//clear current downscaled images
const downscaledImages = fs.readdirSync('./images/l');
for (const image of downscaledImages) {
    fs.unlinkSync(`./images/l/${image}`);
}

for (const image of images) {
    if (image === 'l') continue;
    const imageBuffer = fs.readFileSync(`./images/${image}`);
    //compress image and blur it. make the file size as small as possible
    const downscale = sharp(imageBuffer).resize(100, 100).blur(5);


    const downscaleBuffer = await downscale.toBuffer();
    fs.writeFileSync(`./images/l/${image}`, downscaleBuffer);

}