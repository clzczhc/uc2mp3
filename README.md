# uc2mp3

转换缓存音乐成 mp3，并按`歌手 - 歌曲名.mp3`的形式重命名，以及添加 id3 标签。并且通过`ffprobe`获取原本的配置，保证音频转换质量。

> 执行`npm run start`后选择文件夹，会把该文件夹下的 uc!文件进行转换，生成到本项目根路径下`output`文件夹，另外会有一个中间产物`temp`文件夹。

添加两个步骤版本：（接口频繁请求会会有问题）
`npm run step1`：解码以及转换格式为 mp3
`npm run step2`：按`歌手 - 歌曲名.mp3`的形式重命名，并添加 id3 标签

> node 版本 16.14.0
