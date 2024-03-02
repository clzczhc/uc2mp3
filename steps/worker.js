import fs from "fs";
import path from "path";
import { parentPort } from "worker_threads";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

import ffmpeg from "fluent-ffmpeg";

// 设置后就不需要专门安装ffmpeg了
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const SUFFIX = ".uc!";
const TEMP_DIR = "temp-origin-name";
const OUTPUT_DIR = "output-origin-name";

// esm里面没有__dirname
const __dirname = import.meta.url.slice(8, import.meta.url.lastIndexOf("/"));

// 缓存文件解密
const decode = (file) => {
  return file.map((buffer) => buffer ^ 0xa3);
};

/**
 * 获取转换前的音频的配置，实现保质保量。
 * https://zhuanlan.zhihu.com/p/646617925
 */
const getOutputOptions = async (mp3TempPath) => {
  const { ffprobe } = ffmpeg;

  return new Promise((resolve, reject) => {
    try {
      ffprobe(mp3TempPath, (err, data) => {
        let outputOptions;

        for (const stream of data.streams) {
          const codecType = stream.codec_type;

          if (codecType === "audio") {
            const bitRate = stream.bit_rate;
            const sampleRate = stream.sample_rate;
            const channels = stream.channels;
            const channelLayout = stream.channel_layout;

            outputOptions = [
              `-b:a ${bitRate}`, // 比特率
              `-ar ${sampleRate}`, // 采样率
              `-ac ${channels}`, // 声道数
              `-channel_layout ${channelLayout}`, // 声道布局
            ];
          }
        }

        resolve(outputOptions);
      });
    } catch (error) {
      console.log(mp3TempPath);
      console.log(error.message);
    }
  });
};

/**
 * 音乐缓存的音乐也有m4a格式的，这些格式的音乐没法添加id3标签，所以都通过ffmpeg转为mp3格式
 */
const toMp3 = async (mp3TempPath, mp3Path) => {
  return new Promise(async (resolve) => {
    if (!fs.readdirSync(__dirname).includes(OUTPUT_DIR)) {
      fs.mkdirSync(path.join(__dirname, OUTPUT_DIR));
    }

    if (fs.existsSync(mp3Path)) {
      resolve("done");
      return;
    }

    const command = ffmpeg();

    command.on("end", () => {
      resolve("done");
    });

    command.on("error", (error) => {
      console.log(mp3TempPath);
      console.log(error.message);
      resolve("done");
    });

    const outputOptions = await getOutputOptions(mp3TempPath);
    command.input(mp3TempPath).outputOptions(outputOptions).save(mp3Path);
  });
};

/**
 * 保存文件
 * @param {*} fileName
 * @param {*} decodeBuffer
 */
const saveFile = async (fileName, decodeBuffer) => {
  if (!fs.readdirSync(__dirname).includes(TEMP_DIR)) {
    fs.mkdirSync(path.join(__dirname, TEMP_DIR));
  }

  // 因为ffmpeg不支持原地修改，所以需要临时内容
  const mp3TempPath = path.join(__dirname, TEMP_DIR, fileName);
  const mp3Path = path.join(__dirname, OUTPUT_DIR, fileName);

  if (fs.existsSync(mp3TempPath)) {
    return;
  }

  fs.writeFileSync(mp3TempPath, decodeBuffer);

  await toMp3(mp3TempPath, mp3Path);
};

parentPort.on("message", async ({ dir, fileNames }) => {
  for (let i = 0, len = fileNames.length; i < len; i++) {
    let fileName = fileNames[i];

    const fileBuffer = fs.readFileSync(path.join(dir, fileName));
    const decodeBuffer = decode(fileBuffer);

    fileName = fileName.replace(SUFFIX, "") + ".mp3";
    await saveFile(fileName, decodeBuffer);

    if (i === len - 1) {
      parentPort.postMessage("done");
    }
  }
});
