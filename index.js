import dialog from 'node-file-dialog';

import { start } from './utils.js';

const config = {
  type: 'directory'
};


dialog(config)
  .then(dirs => start(dirs[0]))
  .catch(err => console.log(err.message));