import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";
import dialog from "node-file-dialog";

const SUFFIX = ".uc!";

// esm里面没有__dirname
const __dirname = import.meta.url.slice(8, import.meta.url.lastIndexOf("/"));

const start = async (dir) => {
  const fileNames = fs.readdirSync(dir).filter((file) => file.endsWith(SUFFIX));

  const count = Math.ceil(fileNames.length / 7);

  while (fileNames.length > 0) {
    const workerData = fileNames.splice(0, count);

    const worker = new Worker(path.join(__dirname, "worker.js"));
    worker.postMessage({
      dir: dir,
      fileNames: workerData,
    });

    worker.on("message", (msg) => {
      if (msg === "done") {
        worker.terminate();
      }
    });
  }
};

dialog({
  type: "directory",
})
  .then((dirs) => start(dirs[0]))
  .catch((err) => console.log(err.message));
