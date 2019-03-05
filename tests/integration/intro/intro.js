const BbPromise = require('bluebird')

const idioms = require('../idioms')

module.exports = () => idioms.runIn(__dirname, () => BbPromise.resolve()
  .then(idioms.functionDoesNotExist())
  .then(() => BbPromise.resolve()
    .then(idioms.deploy())
    .then(idioms.functionExists())
    .then(idioms.invoke())
    .then(idioms.expect({ scenariosCreated: 5 }))
    .finally(idioms.remove())
    .then(idioms.functionDoesNotExist()))
)