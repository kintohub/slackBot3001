const emojis = ['🥇', '🥈', '🥉', '⭐', '😭', '👍', '💃', '🤦 oh no..']

exports.getColor = (index, score) => {
  if (index <= 2 && score !== 0) {
    return 'good'
  }
  if (score === 0) {
    return 'danger'
  } else {
    return 'default'
  }
}

exports.getEmojiAndText = (index, player) => {
  return `${emojis[index] || '😅'}${' '}<@${player.name}>`
}
