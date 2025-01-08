import fs from 'fs'
import { GetPBP } from './utils.js'
import 'dotenv/config'
import puppeteer from 'puppeteer'

const output_folder = 'pick_six'

const seasonStart = {
    50: 9654,
    51: 10067,
}

class Main {
    static async Run() {
        const App = new Main()

        console.log('ISFL Pick 6 Scraping')
        let fullOutput = []

        const startSeason = 50
        const endSeason = 50

        for (let i = startSeason; i <= endSeason; i++) {
            const seasonOutput = await App.Start(i)
            fullOutput.push(seasonOutput)
        }
        /*
        fs.writeFile(
            `./${output_folder}/all_scoring.json`,
            JSON.stringify(fullOutput),
            'utf8',
            function (err) {
                if (err) throw err
                console.log(`JSON output complete: Full Output`)
            }
        )
				*/
    }

    async SingleGame(_season, _gameId) {
        const browser = await puppeteer.launch()

        console.log(`Single Game: S${_season} (Game ${_gameId})`)
        const page = await browser.newPage()

        await page.goto(GetPBP(_season, _gameId), {
            waitUntil: 'networkidle0',
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

        return plays
    }

    async Start(_season) {
        const picks = []

        const weeks = 1
        const gamesPerWeek = 7

        const runSingle = true
        const singleGameId = 9713

        if (runSingle) {
            const singleGameData = await this.SingleGame(_season, singleGameId)
            const teamIds = [
                ...new Set(singleGameData.map((play) => play.team)),
            ]

            const gameData = {
                season: _season,
                week: 1,
                game: 1,
                teamA: teamIds[0],
                teamB: teamIds[1],
                plays: singleGameData,
            }

            fs.writeFile(
                `./${output_folder}/s${_season}_game${singleGameId}.json`,
                JSON.stringify(gameData),
                'utf8',
                function (err) {
                    if (err) throw err
                    console.log(
                        `JSON output complete: S${_season} G${singleGameId}`
                    )
                }
            )

            return gameData
        } else {
            const browser = await puppeteer.launch()

            for (let x = 0; x < weeks; x++) {
                for (let y = 0; y < gamesPerWeek; y++) {
                    const gameStrings = []
                    console.log(`S${_season} G${x * gamesPerWeek + y}`)
                    const page = await browser.newPage()

                    await page.goto(
                        GetPBP(
                            _season,
                            seasonStart[_season] + x * gamesPerWeek + y
                        ),
                        {
                            waitUntil: 'networkidle0',
                        }
                    )

                    await page.setViewport({ width: 1080, height: 1024 })

                    for (const span of await page.$$('span')) {
                        gameStrings.push(
                            await (
                                await span.getProperty('innerText')
                            ).jsonValue()
                        )
                    }

                    await page.close()

                    for (const string of gameStrings) {
                        let passer
                        let interceptor
                        let yards
                        let touchdown = false
                        let touchback = false
                        if (string.includes('INTERCEPTION')) {
                            passer =
                                string.split(',')[0].slice(8) +
                                string.split(',')[1]
                            interceptor = string
                                .split('INTERCEPTION by ')[1]
                                .split(' at the ')[0]

                            try {
                                yards = string
                                    .split('returned for ')[1]
                                    .split(' yards')[0]
                            } catch (e) {
                                yards = 25
                                touchback = true
                            }

                            if (string.includes('TOUCHDOWN!')) {
                                touchdown = true
                            }

                            picks.push({
                                passer,
                                interceptor,
                                yards,
                                touchdown,
                                touchback,
                            })
                        }
                    }
                }
            }

            await browser.close()
        }
        return picks
    }
}

Main.Run()
