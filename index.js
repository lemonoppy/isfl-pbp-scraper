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
const SINGLE_RUN_GAME_ID = 9713

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
					ignoreHTTPSErrors: true
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
                document.querySelectorAll('table .Grid > tbody > tr')
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
				plays.map(play => {
					play.team = ParseTeamFromLogoId(_season, Number(play.team))
				})

        return plays
    }

		SetGameData(_season, _week = 0, _game = 0, _plays) {
			const teamIds = [
				...new Set(_plays.map((play) => play.team)),
			]

			return {
					season: _season,
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
            const singleGameData = await this.SingleGame(_season, SINGLE_RUN_GAME_ID)
						const gameData = this.SetGameData(_season, 0, 0, singleGameData);

            fs.writeFile(
                `./${output_folder}_single/s${_season}_g${SINGLE_RUN_GAME_ID}.json`,
                JSON.stringify(gameData),
                'utf8',
                function (err) {
                    if (err) throw err
                    console.log(
                        `JSON output complete: S${_season} G${SINGLE_RUN_GAME_ID}`
                    )
                }
            )

            return gameData
        } else {
            const browser = await puppeteer.launch()

            for (let x = 0; x < weeks; x++) {
                for (let y = 0; y < gamesPerWeek; y++) {
										const gameId = SEASON_START_IDS[_season] + (x * gamesPerWeek) + y
                    const singleGameData = await this.SingleGame(
                        _season,
                        gameId
                    )

										const gameData = this.SetGameData(_season, x + 1, y + 1, singleGameData);

										seasonGames.push(gameData)

                    fs.writeFile(
                        `./${output_folder}/s${_season}_w${x + 1}_g${y + 1}.json`,
                        JSON.stringify(gameData),
                        'utf8',
                        function (err) {
                            if (err) throw err
                            console.log(
                                `JSON output complete: S${_season} W${x + 1} G${y + 1}`
                            )
                        }
                    )
                }
            }

            await browser.close()
        }

				fs.writeFile(
					`./${output_folder}/s${_season}.json`,
					JSON.stringify(seasonGames),
					'utf8',
					function (err) {
							if (err) throw err
							console.log(
									`JSON output complete: S${_season}`
							)
					}
			)

        return seasonGames
    }
}

Main.Run()
