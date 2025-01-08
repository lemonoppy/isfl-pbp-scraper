import fs from 'fs'
import { GetPBP, ParseTeamFromLogoId, GetGameCount } from './utils.js'
import 'dotenv/config'
import puppeteer from 'puppeteer'

const output_folder = 'game_data'

// TODO find the reg season start ids for other seasons
const SEASON_START_IDS = {
  50: 9654,
  51: 10067,
}

// For setting when to start/end
const START_SEASON = 50
const END_SEASON = 50

// Mostly for debugging or getting single games
const RUN_SINGLE = true
const SINGLE_RUN_GAME_ID = 9645

class Main {
  static async Run() {
    const App = new Main()

    console.log('✨ ISFL PBP Scraping Starting ✨')
    let fullOutput = []

    for (let i = START_SEASON; i <= END_SEASON; i++) {
      const seasonOutput = await App.Start(i)
      fullOutput.push(seasonOutput)
    }

    console.log('🎉 ISFL PBP Scraping Complete 🎉')
  }

  async SingleGame(_season, _gameId) {
    const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
    })

    console.log(`Scraping: S${_season} (Game ${_gameId})`)
    const page = await browser.newPage()

    await page.goto(GetPBP(_season, _gameId), {
      waitUntil: 'networkidle0', // Need this to wait til the JS finishes populating page
    })

    await page.setViewport({ width: 1080, height: 1024 })

    const plays = await page.evaluate(() => {
      const data = []
      const rows = Array.from(
        document.querySelectorAll('table .Grid > tbody > tr'),
      )

      rows.forEach((row) => {
        let splitRow = row.textContent.split('\n').map((s) => {
          return s.trim()
        })
        let teamId = -1
        let down = -1
        let distance = -1
        let locationSide = -1
        let locationPosition = -1

        // Get team logo id
        try {
          teamId = row.innerHTML
            .toString()
            .split('/Images/Logos/')[1]
            .split('_')[0]
        } catch (e) {}

        try {
          down = splitRow[3].split(' and ')[0][0]
          distance = splitRow[3].split(' and ')[1]
        } catch (e) {}

        try {
          locationSide = splitRow[4].split(' - ')[0]
          locationPosition = splitRow[4].split(' - ')[1]
        } catch (e) {}

        const play = {
          team: teamId,
          time: splitRow[2],
          down: down,
          distance: distance,
          locationSide: locationSide,
          locationPostion: locationPosition,
          play: splitRow[5],
        }

        data.push(play)
      })
      return data
    })

    await page.close()
    await browser.close()

    // Set team names here, can't do it in puppeteer because it's running in browser
    plays.map((play) => {
      play.team = ParseTeamFromLogoId(_season, Number(play.team))
    })

    return plays
  }

  StripTags(_string) {
    if (!_string || _string == '') return _string

    try {
      if (_string.search('(C)') >= 0) {
        return _string.split(' (C)').join('')
      }
      if (_string.search('(R)') >= 0) {
        return _string.split(' (R)').join('')
      }
    } catch (e) {}
    return _string
  }

  ParsePlay(_play) {
    const { team, down, distance, locationSide, locationPosition, play } = _play
    const parsedPlay = {
      ..._play,
      playType: '',
      yards: 0,

      passer: '',
      target: '',
      rusher: '',
      defender: '',
      kicker: '',
      patKicker: '',
      outcome: '',
      patOutcome: '',

      kickYards: 0,
      returner: '',
      returnYards: 0,

      penalty: false,
      penaltyPlayer: '',
      penaltyType: '',

      parsed: false,
    }

    if (!team || team == '' || team == -1) return parsedPlay

    if (play.search('Pass by') >= 0) {
      parsedPlay.playType = 'PASS'

      if (play.search(' complete to ') >= 0) {
        parsedPlay.outcome = 'COMPLETE'
        parsedPlay.passer = play.split('Pass by ')[1].split(', complete to ')[0]
        parsedPlay.target = play.match(/(?<=to\s+).*?(?=\s+for)/gs)[0]
        parsedPlay.yards = play.match(/(?<=for\s+).*?(?=\s+yds)/gs)[0]

        if (play.search('TOUCHDOWN!') >= 0) {
          parsedPlay.outcome = 'TOUCHDOWN'
        }
      } else {
        parsedPlay.outcome = 'INCOMPLETE'
        parsedPlay.passer = play.split('Pass by ')[1].split(' to ')[0]
        if (play.match(/(?<=to\s+).*?(?=\s+is)/gs))
          parsedPlay.target = play.match(/(?<=to\s+).*?(?=\s+is)/gs)[0]
        if (play.match(/(?<=to\s+).*?(?=\s+falls)/gs))
          parsedPlay.target = play.match(/(?<=to\s+).*?(?=\s+falls)/gs)[0]
      }
      parsedPlay.parsed = true
    }

    if (play.search('Rush by') >= 0) {
      parsedPlay.playType = 'RUSH'
      parsedPlay.rusher = play.match(/(?<=Rush by\s+).*?(?=\s+for)/gs)[0]
      parsedPlay.yards = play.match(/(?<=for\s+).*?(?=\s+yds)/gs)

      if (play.search('.TOUCHDOWN!') >= 0) {
        parsedPlay.outcome = 'TOUCHDOWN'
        parsedPlay.parsed = true
      } else {
        parsedPlay.defender = play
          .split('Tackle by ')[1]
          .split('..')[0]
          .concat('.')

        if (play.search('..First Down!') >= 0) {
          parsedPlay.outcome = 'FIRST_DOWN'
        }
      }

      parsedPlay.parsed = true
    }

    if (play.search('yard FG by') >= 0) {
      parsedPlay.playType = 'FG'
      parsedPlay.outcome = 'FG_GOOD'
      parsedPlay.kicker = play.match(/(?<=yard FG by\s+).*?(?=\s+is)/gs)[0]
      parsedPlay.kickYards = play.split(' yard FG by ')[0]
      if (play.search('is NO good.') >= 0) {
        parsedPlay.outcome = 'FG_NO_GOOD'
      }
      parsedPlay.parsed = true
    }

    if (play.search('spikes the ball') >= 0) {
      parsedPlay.playType = 'SPIKE'
      parsedPlay.passer = play.split(' spikes the ball')[0]
      parsedPlay.parsed = true
    }

    if (play.search('Penalty on') >= 0) {
      parsedPlay.penalty = true
      parsedPlay.penaltyPlayer = play.split('Penalty on ')[1].split(':')[0]
      parsedPlay.penaltyType = play
        .split('Penalty on ')[1]
        .split(':')[1]
        .trim()
        .slice(0, -1)
      parsedPlay.parsed = true
    }

    if (play.search('Punt by') >= 0) {
      parsedPlay.playType = 'PUNT'
      parsedPlay.kickYards = play.match(/(?<=of\s+).*?(?=\s+yards)/gs)
        ? play.match(/(?<=of\s+).*?(?=\s+yards)/gs)[0]
        : 0
      try {
        parsedPlay.kicker = play.match(/(?<=Punt by\s+).*?(?=\s+of)/gs)[0]
      } catch {}

      if (play.search('No return.') == -1) {
        if (play.search('BLOCKED BY') >= 0) {
          parsedPlay.outcome = 'BLOCKED'
          parsedPlay.kicker = play.match(
            /(?<=Punt by\s+).*?(?=\s+is BLOCKED)/gs,
          )[0]
          parsedPlay.returner = play
            .match(/(?<=BLOCKED BY\s+).*?(?=\s+Returned)/gs)[0]
            .slice(0, -1)
        } else {
          parsedPlay.returner = play.match(
            /(?<=Returned by\s+).*?(?=\s+for)/gs,
          )[0]
        }
        parsedPlay.returnYards = play.match(/(?<=for\s+).*?(?=\s+yards\.)/gs)[0]
      }

      parsedPlay.parsed = true
    }

    if (play.search('SACKED by ') >= 0) {
      parsedPlay.playType = 'PASS'
      parsedPlay.outcome = 'SACK'
      parsedPlay.passer = play.split(' is SACKED by ')[0]
      parsedPlay.defender = play.split(' is SACKED by ')[1].split(' - ')[0]
      parsedPlay.yards = play.match(/(?<=for\s+).*?(?=\s+yds)/gs)
      parsedPlay.parsed = true
    }

    if (play.search('Kickoff') >= 0 || play.search('kicks off.') >= 0) {
      parsedPlay.playType = 'KICKOFF'

      if (play.search('Touchback') >= 0 || play.search('touchback') >= 0) {
        try {
          parsedPlay.kicker = play.match(
            /(?<=Kickoff by\s+).*?(?=\s+deep)/gs,
          )[0]
        } catch {}

        try {
          parsedPlay.kicker = play.match(
            /(?<=Kickoff by\s+).*?(?=\s+through)/gs,
          )[0]
        } catch {}

        parsedPlay.outcome = 'TOUCHBACK'
        parsedPlay.parsed = true
      }

      if (play.search('Onsides Kickoff') >= 0) {
        parsedPlay.playType = 'KICKOFF_ONSIDE'
        parsedPlay.outcome = ''
        parsedPlay.kicker = play
          .split('Onsides Kickoff by ')[1]
          .split(' of ')[0]
      }

      // Returned Kickoff
      if (play.search('Returned by ') >= 0) {
        parsedPlay.outcome = 'RETURNED'
        parsedPlay.kickYards = play.split(' ')[2]
        parsedPlay.returner = play.split('Returned by ')[1].split(' for ')[0]
        parsedPlay.returnYards = play.split(' yards.')[1].split(' ').slice(-1)
        parsedPlay.parsed = true
      }

      if (!parsedPlay.kicker) {
        try {
          console.log(play.split('Kickoff by ')[1].split(' of ')[0])
          parsedPlay.kicker = play.split('Kickoff by ')[1].split(' of ')[0]
        } catch {}
      }

      if (!parsedPlay.kicker) {
        try {
          parsedPlay.kicker = play.split(' kicks off.')[0]
        } catch {}
      }

      if (play.search('takes it') >= 0) {
        if (play.search('sails into') >= 0) {
          parsedPlay.returner = play.split(' takes it ')[0].split('!')[1]
          parsedPlay.parsed = true
        } else {
          parsedPlay.returner = play.split(' takes it ')[0].split('yards.')[1]
          parsedPlay.parsed = true
        }
      }
    }

    if (play.search('kneels the ball') >= 0) {
      parsedPlay.playType = 'KNEEL'
      parsedPlay.parsed = true
    }

    if (play.search('kick good\\)') >= 0) {
      parsedPlay.patOutcome = 'GOOD'
      parsedPlay.patKicker = play.split('(').slice(-1)[0].split(' kick ')[0]
    }

    if (play.search('kick NO good\\)') >= 0) {
      parsedPlay.patOutcome = 'NO_GOOD'
      parsedPlay.patKicker = play.split('(').slice(-1)[0].split(' kick ')[0]
    }

    if (!parsedPlay.parsed) {
      console.log(parsedPlay)
    }

    parsedPlay.yards = Number(parsedPlay.yards)
    parsedPlay.returnYards = Number(parsedPlay.returnYards)
    parsedPlay.kickYards = Number(parsedPlay.kickYards)
    parsedPlay.passer = this.StripTags(parsedPlay.passer)
    parsedPlay.target = this.StripTags(parsedPlay.target)
    parsedPlay.rusher = this.StripTags(parsedPlay.rusher)
    parsedPlay.defender = this.StripTags(parsedPlay.defender)
    parsedPlay.kicker = this.StripTags(parsedPlay.kicker)
    parsedPlay.returner = this.StripTags(parsedPlay.returner)

    return parsedPlay
  }

  async SingleGameBreakdown(_season, _gameId) {
    const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
    })

    console.log(`Scraping: S${_season} (Game ${_gameId})`)
    const page = await browser.newPage()

    await page.goto(GetPBP(_season, _gameId), {
      waitUntil: 'networkidle0', // Need this to wait til the JS finishes populating page
    })

    await page.setViewport({ width: 1080, height: 1024 })

    const plays = await page.evaluate(() => {
      const data = []
      const rows = Array.from(
        document.querySelectorAll('table .Grid > tbody > tr'),
      )

      rows.forEach((row) => {
        let splitRow = row.textContent.split('\n').map((s) => {
          return s.trim()
        })
        let teamId = -1
        let down = -1
        let distance = -1
        let locationSide = -1
        let locationPosition = -1

        // Get team logo id
        try {
          teamId = row.innerHTML
            .toString()
            .split('/Images/Logos/')[1]
            .split('_')[0]
        } catch (e) {}

        try {
          down = splitRow[3].split(' and ')[0][0]
          distance = splitRow[3].split(' and ')[1]
        } catch (e) {}

        try {
          locationSide = splitRow[4].split(' - ')[0]
          locationPosition = splitRow[4].split(' - ')[1]
        } catch (e) {}

        const play = {
          team: teamId,
          time: splitRow[2],
          down: down,
          distance: distance,
          locationSide: locationSide,
          locationPostion: locationPosition,
          play: splitRow[5],
        }

        data.push(play)
      })
      return data
    })

    await page.close()
    await browser.close()

    const parsedCount = [0, 0]
    const parsedPlays = []
    // Set team names here, can't do it in puppeteer because it's running in browser
    plays.map((play) => {
      play.team = ParseTeamFromLogoId(_season, Number(play.team))
      if (play.team) {
        const parsed = this.ParsePlay(play)
        play = {
          ...play,
          ...parsed,
        }
        parsedPlays.push(play)
        if (parsed.parsed) parsedCount[0]++
        else parsedCount[1]++
      }
    })

    console.log(`[Parsed/Unparsed] : [${parsedCount[0]}/${parsedCount[1]}]`)
    return parsedPlays
  }

  SetGameData(_season, _gameId, _week = 0, _game = 0, _plays) {
    const teamIds = [...new Set(_plays.map((play) => play.team))]

    return {
      season: _season,
      gameId: _gameId,
      week: _week,
      game: _game,
      teamHome: teamIds[1], // Home team always kicks ball away first
      teamAway: teamIds[3],
      plays: _plays,
    }
  }

  async Start(_season) {
    // TODO week count variable check for earlier seasons
    const weeks = 16
    const gamesPerWeek = GetGameCount(_season)

    const seasonGames = []

    if (RUN_SINGLE) {
      // const singleGameData = await this.SingleGame(_season, SINGLE_RUN_GAME_ID)
      const singleGameData = await this.SingleGameBreakdown(
        _season,
        SINGLE_RUN_GAME_ID,
      )
      const gameData = this.SetGameData(
        _season,
        SINGLE_RUN_GAME_ID,
        0,
        0,
        singleGameData,
      )

      fs.writeFile(
        `./${output_folder}_single/s${_season}_g${SINGLE_RUN_GAME_ID}.json`,
        JSON.stringify(singleGameData),
        'utf8',
        function (err) {
          if (err) throw err
          console.log(
            `JSON output complete: S${_season} G${SINGLE_RUN_GAME_ID}`,
          )
        },
      )

      return gameData
    } else {
      const browser = await puppeteer.launch()

      for (let x = 0; x < weeks; x++) {
        for (let y = 0; y < gamesPerWeek; y++) {
          const gameId = SEASON_START_IDS[_season] + x * gamesPerWeek + y
          const singleGameData = await this.SingleGame(_season, gameId)

          const gameData = this.SetGameData(
            _season,
            gameId,
            x + 1,
            y + 1,
            singleGameData,
          )

          seasonGames.push(gameData)

          fs.writeFile(
            `./${output_folder}/s${_season}_w${x + 1}_g${y + 1}.json`,
            JSON.stringify(gameData),
            'utf8',
            function (err) {
              if (err) throw err
              console.log(
                `JSON output complete: S${_season} W${x + 1} G${y + 1}`,
              )
            },
          )
        }
      }

      await browser.close()
    }

    // Output seasonal play list
    fs.writeFile(
      `./${output_folder}/s${_season}.json`,
      JSON.stringify(seasonGames),
      'utf8',
      function (err) {
        if (err) throw err
        console.log(`JSON output complete: S${_season}`)
      },
    )

    return seasonGames
  }
}

Main.Run()
