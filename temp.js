// https://zhuanlan.zhihu.com/p/646617925?utm_id=0

import ffmpeg from "fluent-ffmpeg";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

// 设置后就不需要专门安装ffmpeg了
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const command = ffmpeg();

const { ffprobe } = ffmpeg;
ffprobe("./x.mp3", (err, data) => {
  let outputOptions;

  for (const stream of data.streams) {
    const codecType = stream.codec_type;

    if (codecType === "audio") {
      const bitrate = stream.bit_rate;
      const sampleRate = stream.sample_rate;
      const channels = stream.channels;
      const channelLayout = stream.channel_layout;

      outputOptions = [
        `-b:a ${bitrate}`, // 比特率
        `-ar ${sampleRate}`, // 采样率
        `-ac ${channels}`, // 声道数
        `-channel_layout ${channelLayout}`, // 声道布局
      ];
    }
  }

  command
    .input("./x.mp3")
    .outputOptions(outputOptions)
    .save("./output.mp3")
    .on("end", () => {
      console.log("转码完成");
    });
  // .run();
});
