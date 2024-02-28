import fs from "fs";
import { Worker } from "worker_threads";
import dialog from "node-file-dialog";

const SUFFIX = ".uc!";

const start = async (dir) => {
  const fileNames = fs.readdirSync(dir).filter((file) => file.endsWith(SUFFIX));

  const count = Math.ceil(fileNames.length / 7);

  while (fileNames.length > 0) {
    const workerData = fileNames.splice(0, count);

    const worker = new Worker("./worker.js");
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
