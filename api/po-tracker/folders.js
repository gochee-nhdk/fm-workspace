const handler = require('../index.js');

module.exports = (req, res) => {
  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0].replace(/^\/api/, '');
  return handler(req, res, pathname || '/po-tracker/folders');
};
