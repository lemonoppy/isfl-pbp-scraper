function GetGameCount(_season) {
    if (_season === 1) {
        return 3;
    }
    if (_season <= 15) {
        return 4;
    }
    if (_season <= 21) {
        return 5;
    }
    if (_season <= 24) {
        return 6;
    }
    return 7;
}

function ParseWeekNumber(_index, _season) {
    // S2 is fucked cause they didn't fix the scheduling yet
    if (_season === 2) {
        if(_index >= 16 && _index <= 47)
            return Math.ceil((_index + 1) / GetGameCount(_season)) - 4

        if(_index >= 48 && _index <= 66)
            return Math.ceil((_index + 2) / GetGameCount(_season)) - 4

        if(_index >= 67)
            return Math.ceil((_index + 3) / GetGameCount(_season)) - 4
    }

    return Math.ceil(_index / GetGameCount(_season)) - 5 < 0
        ? Math.ceil(_index / GetGameCount(_season)) - 5
        : Math.ceil(_index / GetGameCount(_season)) - 4
}

function ParseTeamName(_name) {
    switch (_name) {
        case 'Copperheads':
            return "AUS";
        case 'Outlaws':
            return "AZ";
        case 'Hahalua':
            return "HON";
        case 'Legion':
            return "LVL";
        case 'Second':
        case 'Secondline':
            return "NOLA";
        case 'Silverbacks':
            return "NYS";
        case 'Otters':
            return "OCO";
        case 'SaberCats':
            return "SJS";
        case 'Hawks':
            return "BAL";
        case 'Fire':
						return 'BER';
				case 'Black':
				case 'Brood':
            return "BFB";
        case 'Butchers':
						return "CHI";
        case 'Kaiju':
            return "OSK";
        case 'Yeti':
            return "COL";
        case 'Crash':
            return "CTC";
        case 'Liberty':
            return "PHI";
        case 'Sailfish':
            return "SAR";
        case 'Wraiths':
            return "YKW";
    }
}

function ParseTeamNameModern(_name) {
    switch (_name) {
        case 'Copperheads':
            return "AUS";
        case 'Outlaws':
            return "AZ";
        case 'Hahalua':
            return "HON";
        case 'Legion':
        case 'Second':
        case 'Secondline':
            return "NOLA";
        case 'Silverbacks':
            return "NYS";
        case 'Otters':
            return "OCO";
        case 'SaberCats':
            return "SJS";
        case 'Hawks':
            return "BAL";
        case 'Fire':
				case 'Black':
				case 'Brood':
            return "BFB";
				case 'Butchers':
				case 'Kaiju':
						return "OSK";
        case 'Yeti':
            return "COL";
        case 'Liberty':
        case 'Crash':
            return "CTC";
        case 'Sailfish':
            return "SAR";
        case 'Wraiths':
            return "YKW";
    }
}

function ParseTeam(_score, _modern = false) {
    let teamName = _score.children[0].children[1].data.trim().split(' ')[0];

    if (teamName.length <= 0) {
        try {
            teamName = _score.children[0].children[2].children[0].data.trim().split(' ')[0]
        } catch (e) {
            console.log(e)
        }
    }

    return {
        team: _modern ? ParseTeamNameModern(teamName) : ParseTeamName(teamName),
        first: parseInt(_score.children[1].children[0].data),
        second: parseInt(_score.children[2].children[0].data),
        third: parseInt(_score.children[3].children[0].data),
        fourth: parseInt(_score.children[4].children[0].data),
        overtime: _score.children.length === 7 ? parseInt(_score.children[5].children[0].data) : -1,
        final: _score.children.length === 7 ? parseInt(_score.children[6].children[0].data) : parseInt(_score.children[5].children[0].data),
    };
}

function GetIndex(_season) {
    if (_season <= 9) {
        return `https://index.sim-football.com/NSFLS0${_season}/GameResults.html`
    }
    if (_season <= 23) {
        return `https://index.sim-football.com/NSFLS${_season}/GameResults.html`
    }
    return `https://index.sim-football.com/ISFLS${_season}/GameResults.html`
}

function GetPBP(_season, _gameId) {
	if (_season <= 9) {
		return `https://index.sim-football.com/NSFLS0${_season}/Logs/${_gameId}.html`
	}
	if (_season <= 23) {
			return `https://index.sim-football.com/NSFLS${_season}/Logs/${_gameId}.html`
	}
	return `https://index.sim-football.com/ISFLS${_season}/Logs/PBP.html?id=${_gameId}`
}

const TEAM_ABV = ["AUS", "AZ", "BAL", "BER", "BFB", "CHI", "COL", "CTC", "HON", "LVL", "NOLA", "NYS", "OCO", "OSK", "PHI", "SAR", "SJS", "YKW"];

const TEAM_ABV_MODERN = ["AUS", "AZ", "BAL", "BFB", "OSK", "COL", "CTC", "HON", "NOLA", "NYS", "OCO", "SAR", "SJS", "YKW"];

export { GetGameCount, ParseWeekNumber, ParseTeamName, ParseTeamNameModern, ParseTeam, GetIndex, GetPBP, TEAM_ABV, TEAM_ABV_MODERN }