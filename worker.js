import fs from "fs";
import path from "path";
import { parentPort } from "worker_threads";
import NodeID3 from "node-id3";
import fetch from "node-fetch";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

import ffmpeg from "fluent-ffmpeg";
// 设置后就不需要专门安装ffmpeg了
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const OUTPUT_DIR = "output";
const LIMIT_FILE_REG = /\/|:|\*|\?|"|<|>|\|/g; // 文件名不能包含的字符

// esm里面没有__dirname
const __dirname = import.meta.url.slice(8, import.meta.url.lastIndexOf("/"));

// 缓存文件解密
const decode = (file) => {
  return file.map((buffer) => buffer ^ 0xa3);
};

/**
 * 获取专辑图片
 * 返回格式是node-id3标签的image类型
 */
const getAlbumImage = async (imgUrl) => {
  const res = await fetch(imgUrl);
  const arrayBuffer = await res.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  const image = {
    mime: "image/jpeg",
    type: { id: 6, name: "media" },
    imageBuffer,
  };

  return image;
};

/**
 * 根据歌曲id获取歌曲信息
 * @param {*} songId
 * @returns tags 标签新信息
 */
const getSongInfo = async (songId) => {
  const res = await fetch(
    `https://music.163.com/api/song/detail/?ids=[${songId}]`
  );
  const data = await res.json();

  const song = data.songs[0];

  return {
    title: song.name,
    artist: song.artists.map((artist) => artist.name).join(" "),
    album: song.album.name,
    image: await getAlbumImage(song.album.picUrl),
  };
};

/**
 * 给mp3添加id3标签
 */
const addId3 = (mp3Path, songInfo) => {
  const tags = songInfo;
  NodeID3.write(tags, mp3Path);
};

/**
 * 获取转换前的音频的配置，实现保质保量。
 * https://zhuanlan.zhihu.com/p/646617925
 */
const getOutputOptions = async (mp3TempPath) => {
  const { ffprobe } = ffmpeg;

  return new Promise((resolve, reject) => {
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
  });
};

/**
 * 音乐缓存的音乐也有m4a格式的，这些格式的音乐没法添加id3标签，所以都通过ffmpeg转为mp3格式
 */
const toMp3 = async (mp3TempPath, mp3Path, songInfo) => {
  return new Promise(async (resolve) => {
    if (!fs.readdirSync(__dirname).includes(OUTPUT_DIR)) {
      fs.mkdirSync(path.join(__dirname, OUTPUT_DIR));
    }

    const command = ffmpeg();

    command.on("end", () => {
      addId3(mp3Path, songInfo);
      resolve("done");
    });

    const outputOptions = await getOutputOptions(mp3TempPath);

    command.input(mp3TempPath).outputOptions(outputOptions).save(mp3Path);
  });
};

/**
 * 保存文件
 * @param {*} fileNames
 * @param {*} songInfo
 * @returns mp3FileName
 */
const saveFile = async (songInfo, decodeBuffer) => {
  if (!fs.readdirSync(__dirname).includes("temp")) {
    fs.mkdirSync(path.join(__dirname, "temp"));
  }

  let fileName = `${songInfo.artist} - ${songInfo.title}.mp3`;
  fileName = fileName.replace(LIMIT_FILE_REG, "-");

  // 因为ffmpeg不支持原地修改，所以需要临时内容
  const mp3TempPath = path.join("temp", fileName);

  const mp3Path = path.join(OUTPUT_DIR, fileName);

  fs.writeFileSync(mp3TempPath, decodeBuffer);

  await toMp3(mp3TempPath, mp3Path, songInfo);
};

parentPort.on("message", async ({ dir, fileNames }) => {
  for (let i = 0, len = fileNames.length; i < len; i++) {
    const fileName = fileNames[i];

    const fileBuffer = fs.readFileSync(path.join(dir, fileName));
    const decodeBuffer = decode(fileBuffer);

    const songId = fileName.slice(0, fileName.indexOf("-"));
    const songInfo = await getSongInfo(songId);

    await saveFile(songInfo, decodeBuffer);

    if (i === len - 1) {
      parentPort.postMessage("done");
    }
  }
});
