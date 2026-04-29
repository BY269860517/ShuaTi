const path = require('node:path')

function sharedModule(relativePath) {
  return require(path.join(
    __dirname,
    '..',
    '..',
    'uniCloud-alipay',
    'cloudfunctions',
    'common',
    'shuati-shared',
    relativePath,
  ))
}

module.exports = {
  sharedModule,
}
