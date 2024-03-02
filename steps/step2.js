import fs from "fs";
import path, { resolve } from "path";
import NodeID3 from "node-id3";
import fetch from "node-fetch";

// esm里面没有__dirname
const __dirname = import.meta.url.slice(8, import.meta.url.lastIndexOf("/"));

const OUTPUT_DIR = "output-origin-name";
const LIMIT_FILE_REG = /\/|:|\*|\?|"|<|>|\|/g; // 文件名不能包含的字符

const originNameReg = /^(\d+)-(\d+)-(.+)\.mp3$/;

/**
 * 给mp3添加id3标签
 */
const addId3 = (mp3Path, songInfo) => {
  const tags = songInfo;
  NodeID3.write(tags, mp3Path);
};

const rename = (mp3Path, songInfo) => {
  let fileName = `${songInfo.artist} - ${songInfo.title}.mp3`;
  fileName = fileName.replace(LIMIT_FILE_REG, "-");

  fs.renameSync(mp3Path, path.join(__dirname, OUTPUT_DIR, fileName));
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

const waitRandomTime = (min, max) => {
  return new Promise((resolve) => {
    const time = Math.floor(Math.random() * (max - min + 1)) + min;

    setTimeout(() => resolve(), time);
  });
};

const start = async () => {
  const fileNames = fs
    .readdirSync(path.join(__dirname, OUTPUT_DIR))
    .filter((file) => originNameReg.test(file));

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    const songId = fileName.slice(0, fileName.indexOf("-"));
    const songInfo = await getSongInfo(songId);

    const mp3Path = path.join(__dirname, OUTPUT_DIR, fileName);
    addId3(mp3Path, songInfo);
    rename(mp3Path, songInfo);

    await waitRandomTime(500, 1500);
  }
};

start();
