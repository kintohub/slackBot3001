require('dotenv').config()
const express = require('express')
const request = require('request-promise-native')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const app = express()

// reg-ex to get userId from slack name
const userSlackId = /([A-Z])\w+/g

// env variables that will become custom params
const PORT = process.env.PORT || '8000'
const KINTOHUB_CLIENTID = process.env.KINTOHUB_CLIENTID
const KINTOHUB_MICROSERVICE = process.env.KINTOHUB_MICROSERVICE

// kintocrud url created using client id and microservice name
const databaseMicroserviceUrl = `https://public.api.staging.kintohub.com/${KINTOHUB_CLIENTID}/${KINTOHUB_MICROSERVICE}`

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// for logging in development locally
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

/**
 * @api {post} /add-player Adds new player to the league
 * @apiName addPlayer
 * @apiParam {String} text the entered text from the slash command containing only the username of the player to add
 * @apiSuccess (200) {Object} returns confirmation message to slack
 */
app.post('/add-player', (req, res) => {
  const text = req.body.text
  const username = text.match(userSlackId).toString()

  console.log(username)
  const options = {
    method: 'POST',
    uri: `${databaseMicroserviceUrl}/create`,
    form: {
      name: username,
      score: 0
    },
    json: true
  }
  request(options)
    .then(response => {
      res.send({
        response_type: 'in_channel',
        attachments: [
          {
            fallback: `<@${username}> has joined the league!`,
            pretext: `New Player!`,
            text: `<@${username}> has joined the league with a score of 0!`,
            color: 'good'
          }
        ]
      })
    })
    .catch(error => {
      res.send({
        message: `failed: ${error}`
      })
    })
})

/**
 * @api {post} /get-player Adds new player to the league
 * @apiParam {String} text the entered text from the slash command containing only the username of the player to search for
 * @apiName getPlayerDetails
 * @apiSuccess (200) {Object} returns the confirmation message to be shown in slack
 */
app.post('/get-player', (req, res) => {
  const text = req.body.text
  const username = text.match(userSlackId).toString()
  request({
    method: 'GET',
    uri: `${databaseMicroserviceUrl}/get/${username}`,
    json: true
  }).then(
    response => {
      res.send({
        response_type: 'in_channel',
        attachments: [
          {
            fallback: `Player details!`,
            title: `Player deets for you!`,
            text: `<@${response.name}> has a score of ${response.score} 😘`,
            color: 'good'
          }
        ]
      })
    },
    error => {
      console.log(error)
      res.send({ error: `${error}` })
    }
  )
})

/**
 * @api {post} /todays-winner Adds new player to the league
 * @apiParam {String} text the entered text from the slash command containing only the username to search for
 * @apiName addTodaysWinner
 * @apiSuccess (200) {Object} returns a slack message showing the players new score
 */
app.post('/todays-winner', (req, res) => {
  const text = req.body.text
  const username = text.match(userSlackId).toString()
  request({
    method: 'PUT',
    uri: `${databaseMicroserviceUrl}/${username}/update`,
    json: true
  }).then(
    response => {
      const winner = response
      res.send({
        response_type: 'in_channel',
        attachments: [
          {
            fallback: `the new winner is <@${winner.name}>!`,
            title: `Announcing Todays Towerfall Winner!`,
            text: `<@${winner.name}> now has a score of ✨${
              winner.score
            }✨, congratulations!`,
            color: 'good'
          }
        ]
      })
    },
    error => {
      res.send({ error })
    }
  )
})

/**
 * @api {post} /todays-winner Adds new player to the league
 * @apiParam {String} text the entered text from the slash command containing only the username to search for
 * @apiName getAllPlayerDetails
 * @apiSuccess (200) {Object} returns a slack message showing a complete list of all the players in the league
 */
app.post('/all', (req, res) => {
  request({
    method: 'GET',
    uri: `${databaseMicroserviceUrl}/all`,
    json: true
  }).then(
    response => {
      const emojis = ['🥇', '🥈', '🥉', '💩', '😘', '👍', '💃', '🤦']
      const getColor = (i, score) => {
        if (i <= 3) {
          return 'good'
        }
        if (score === 0) {
          return 'danger'
        } else {
          return 'default'
        }
      }
      let attachments = [{ pretext: 'All the Towerfall Scores!' }]

      response
        .sort(function(a, b) {
          return a.score - b.score
        })
        .reverse()

      response.forEach((x, i) => {
        attachments.push({
          color: `${getColor(i, x.score)}`,
          fields: [
            {
              value: `${emojis[i] || '😅'}${' '} <@${x.name}>`,
              short: true
            },
            {
              value: `${x.score}`,
              short: true
            }
          ]
        })
      })

      res.send({
        response_type: 'in_channel',
        reply_broadcast: true,
        attachments: attachments
      })
    },
    error => {
      res.send({ error: `${error}` })
    }
  )
})

/**
 * @api {post} /player-remove Adds new player to the league
 * @apiParam {String} text the entered text from the slash command containing only the username to delete
 * @apiName deletePlayer
 * @apiSuccess (200) {Object} confirmtion a slack message confirming the player has been deleted
 */
app.post('/player-remove', (req, res) => {
  const text = req.body.text
  const username = text.match(userSlackId).toString()
  request({
    method: 'DELETE',
    uri: `${databaseMicroserviceUrl}/${username}/delete`,
    json: true
  }).then(
    () => {
      res.send({
        response_type: 'in_channel',
        attachments: [
          {
            fallback: `<@${username}> has been removed from the league!`,
            pretext: `Deleted!`,
            text: `<@${username}> has been removed from the league!`,
            color: 'good'
          }
        ]
      })
    },
    error => {
      res.send({ error: `${error}` })
    }
  )
})

app.listen(PORT, () => console.log(`App listening on this port here: ${PORT}!`))
