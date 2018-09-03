require('dotenv').config()
const express = require('express')
const request = require('request-promise-native')
const bodyParser = require('body-parser')
const app = express()

const helpers = require('./helpers/helper')

// reg-ex to get userId from slack name
const userSlackId = /([A-Z])\w+/g

// env variables that will become custom params
const PORT = process.env.PORT || '3000'
const KINTOHUB_CLIENTID = process.env.KINTOHUB_CLIENTID
const KINTOHUB_MICROSERVICE = process.env.KINTOHUB_MICROSERVICE

// kintocrud url created using client id and microservice name
// const databaseMicroserviceUrl = `https://public.api.staging.kintohub.com/${KINTOHUB_CLIENTID}/${KINTOHUB_MICROSERVICE}`
const databaseMicroserviceUrl = 'https://backendcrud.localtunnel.me'

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// for logging on KintoHub
const logError = (requestId, error) => {
  console.log(
    JSON.stringify({
      kinto_request_id: requestId,
      error: error
    })
  )
}

/**
 * @api {post} /add-player Adds new player to the league
 * @apiName addPlayer
 * @apiParam {String} text the entered text from the slash command containing only the username of the player to add
 * @apiSuccess (200) {Object} returns confirmation message to slack
 */
app.post('/add-player', (req, res) => {
  const text = req.body.text
  const username = text.match(userSlackId).toString()
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
      res.set('Content-Type', 'application/json').send({
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
      const requestId = req.get('kinto-request-id')
      logError(requestId, error)
      res.set('Content-Type', 'application/json').send({
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
      res.set('Content-Type', 'application/json').send({
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
      const requestId = req.get('kinto-request-id')
      logError(requestId, error)
      res.send({ error: `${error}` })
    }
  )
})

/**
 * @api {post} /todays-winner Adds increments the score of one person in the league
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
      res.set('Content-Type', 'application/json').send({
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
      const requestId = req.get('kinto-request-id')
      logError(requestId, error)
      res.send({ error })
    }
  )
})

/**
 * @api {post} /todays-scores logs all the scores for the day
 * @apiName todaysScores
 * @apiSuccess (200) {Object} returns a slack message showing the updated league
 */
app.post('/todays-scores', (req, res) => {
  const text = req.body.text
  const usernames = text.match(userSlackId)
  const namesAndScores = text.split(',')
  const scores = namesAndScores.map(x => {
    return x.substr(x.length - 1)
  })
  const players = usernames.map((player, index) => {
    return {
      username: usernames[index],
      score: parseInt(scores[index])
    }
  })

  request({
    method: 'PUT',
    uri: `${databaseMicroserviceUrl}/update-all`,
    body: { players },
    json: true
  }).then(
    response => {
      response.sort(function(a, b) {
        return b.score - a.score
      })

      const attachments = response.map((player, index) => {
        return {
          color: `${helpers.getColor(index, player.score)}`,
          fields: [
            {
              value: helpers.getEmojiAndText(index, player),
              short: true
            },
            {
              value: player.score,
              short: true
            }
          ]
        }
      })
      attachments.unshift({
        pretext: `Here are all the ✨NEW✨ scores after todays EPIC battle!`
      })
      res.set('Content-Type', 'application/json').send({
        response_type: 'in_channel',
        reply_broadcast: true,
        attachments: attachments
      })
    },
    error => {
      console.log(error)
    }
  )
})

/**
 * @api {post} /all Adds new player to the league
 * @apiName getAllPlayerDetails
 * @apiHeader (Config) {String} total-players this is being added in kintohub to account for total players
 * @apiSuccess (200) {Object} returns a slack message showing a complete list of all the players in the league
 */
app.post('/all', (req, res) => {
  const totalPlayers = req.get('total-players')
  request({
    method: 'GET',
    uri: `${databaseMicroserviceUrl}/all`,
    json: true
  }).then(
    response => {
      response.sort(function(a, b) {
        return b.score - a.score
      })

      const attachments = response.map((player, index) => {
        return {
          color: `${helpers.getColor(index, player.score)}`,
          fields: [
            {
              value: helpers.getEmojiAndText(index, player),
              short: true
            },
            {
              value: player.score,
              short: true
            }
          ]
        }
      })
      attachments.unshift({
        pretext: `All the Towerfall Scores! Currently there are ${totalPlayers} active players`
      })
      res.set('Content-Type', 'application/json').send({
        response_type: 'in_channel',
        reply_broadcast: true,
        attachments: attachments
      })
    },
    error => {
      const requestId = req.get('kinto-request-id')
      logError(requestId, error)
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
      res.set('Content-Type', 'application/json').send({
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
      const requestId = req.get('kinto-request-id')
      logError(requestId, error)
      res.set('Content-Type', 'application/json').send({ error: `${error}` })
    }
  )
})

app.listen(PORT, () => console.log(`App listening on this port here: ${PORT}!`))
