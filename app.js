require('dotenv').config()
// require('./auth/slackAuth.js') // WIP just pseudo code for the slack auth process
const express = require('express')
const request = require('request-promise-native')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const app = express()

// env variables that will become custom params
const PORT = process.env.PORT || '8000'
const KINTOHUB_CLIENTID = process.env.KINTOHUB_CLIENTID
const KINTOHUB_MICROSERVICE = process.env.KINTOHUB_MICROSERVICE

// kintocrud url created using client id and microservice name
const databaseMicroserviceUrl = `https://public.api.staging.kintohub.com/${KINTOHUB_CLIENTID}/${KINTOHUB_MICROSERVICE}`

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(morgan('combined'))

/**
 * @api {get} /hello/{name} Prints "Hello {name}"
 * @apiName HelloWorld
 * @apiParam (Url) {String} name the name to print
 * @apiSuccess (200) {String} message the hello {name} message
 */
app.get('/hello/:name', (req, res) =>
  res.send({
    message: `Hello ${req.params.name}`
  })
)

app.post('/new/player', (req, res) => {
  const fullname = req.body.text
  const name = fullname.substring(1)

  const options = {
    method: 'POST',
    uri: `${databaseMicroserviceUrl}/create`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: {
      name: name,
      score: 0
    },
    json: true
  }
  request(options)
    .then(() => {
      res.send({
        message: 'completed'
      })
    })
    .catch(error => {
      res.send({
        message: `failed: ${error}`
      })
    })
})

app.listen(PORT, () => console.log(`App listening on this port here: ${PORT}!`))
