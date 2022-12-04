import { readFileSync } from "fs";
import { EventTemp, ResultTemp, GameTemp, MatchTemp } from "./types";
import { organizations } from "./orgList";
import { match } from "assert";

export const events = new Map<string, EventTemp>();
export const results = new Map<string, ResultTemp>();
export const games = new Map<string, GameTemp>();
export const matches = new Map<string, MatchTemp>();

export function parseCSV() {
    // TODO: make this actually inputtable from command line
    const filename = 'Classic_Tetris_Match_Database_MatchHistory_Delimited.txt'
    const result = readFileSync(filename, 'utf-8');
    
    // Split result into a 2d array
    const finalResult: string[] = result.split("\r\n");
    finalResult.shift();

    const twoPlayerMatches = new Map<string, string[]>();
    const threePlayerMatches = new Map<string, string[][]>();
    
    finalResult.forEach(f => {
        const row = f.split("|");
        const id = row[0];
        let m: string[] | undefined;
        let m2: string[][] | undefined;
        if ((m = twoPlayerMatches.get(id)) !== undefined) {
            twoPlayerMatches.delete(id);
            threePlayerMatches.set(id, [m, row]);
        }
        else if ((m2 = threePlayerMatches.get(id)) !== undefined) {
            m2.push(row);
        }
        else
            twoPlayerMatches.set(id, row);
    });

    // categorize each line
    for (let i = 1, a = finalResult.length; i < a; ++i) {

        /* here's how the array breaks down:
        0  : match number
        1  : first player name
        2  : first player score
        3  : second player score
        4  : second player name
        5  : bestOf
        6  : total competitors in match
        7  : event name
        8  : edition
        9  : date/time
        10 : round
        11 : streamer/location
        12 : competitve or friendly
        */
        
        const [
            matchNumber,
            p1Name,
            p1Score,
            p2Score,
            p2Name,
            , // bestOf (unused)
            , // playerCount (unused)
            eventName,
            eventEdition,
            timestamp,
            , // round (unused)
            location,
            matchType
        ] = finalResult[i].split("|");
        
        const eventId = eventName + " " + eventEdition;
        
        // Create a new event if necessary
        if (!events.has(eventId)) {
            const e: EventTemp = {
                id: eventId,
                name: eventId,
                organizer: location,
                matches: []
            };
            events.set(eventId, e);
            
            // Set the organization, creating a new one if necessary
            const org = orgExists([eventId, location]);

            if (org !== null)
                organizations.get(org)?.events.push(e);

            else {
                organizations.set(location, {
                    id: location,
                    keywords: [location],
                    name: location,
                    events: [e]
                });
            }
        }

        // dispatch depending on player count
        if (threePlayerMatches.has(matchNumber))
            handleThreePlayerMatch(
                threePlayerMatches.get(matchNumber),
                eventId
            );
        else
            handleTwoPlayerMatch(
                matchNumber,
                p1Name, p1Score,
                p2Name, p2Score,
                eventName,
                timestamp,
                matchType
            );
    
    
    // Rectify Games and Results, handling 3+ player matches differently from 2 player
    var multiplayerMatches: MatchTemp[] = [];
    var sweepCase: MatchTemp[] = [];
    for (var match of matches.entries()) {
        if (match[1].players.length > 2) {
            multiplayerMatches.push(match[1]);
            /*
            Problem: For 3 player matches, the results are stored as 3 different games between each pair of player.
            We need to change this to figure out how many games actually got played and store multiple games with three results for each
            
            For players a, b, c, we have results ab, ac, bc,
            For games g, each result will total both sides to g
            Where A is how many games a beat b, C is how many games c beat a, and B is how many games b beat c
            |  a  |  b  |  c  |
            ab |  A  | g-A |  X  | 
            ac | g-C |  X  |  C  |
            bc |  X  |  B  | g-B |
            
            We need to determine the order of rankings for each game.
            
            Special cases:
            
            player a wins all games against player b:
            Solved, as ac determines how many games a vs c are first, and bv determines how many games b vs c are last
            14 matches fit this case; 13 remain to be solved
            
            */
            var gameOne: number[] = [match[1].games[0].results[0].score, match[1].games[0].results[1].score];   //ab
            var gameTwo: number[] = [match[1].games[1].results[0].score, match[1].games[1].results[1].score];   //ac
            var gameThree: number[] = [match[1].games[2].results[0].score, match[1].games[2].results[1].score]; //bc
            var trueGameTotal: number = gameOne[0] + gameOne[1];
            var trueGameStandings: PlayerTemp[];
            
            // TODO: properly detect which games are which matchups since there isn't actually a standard order
            var playerA: PlayerTemp = match[1].games[0].results[0].player;
            var playerB: PlayerTemp = match[1].games[0].results[1].player;
            var playerC: PlayerTemp = match[1].games[1].results[1].player;
            
            if (gameOne[0] > gameOne[1]) { // a > b
                if (gameTwo[0] > gameTwo[1]) { // a > c
                    if (gameThree[0] > gameThree[1]) { // b > c
                        trueGameStandings = [playerA,
                            playerB,
                            playerC];
                        } else { // c > b
                            trueGameStandings = [playerA,
                                playerC,
                                playerB];
                            }
                        } else { // c > a (forces c > b)
                            trueGameStandings = [playerC,
                                playerA,
                                playerB];
                            }
                        } else { // b > a
                            if (gameTwo[0] > gameTwo[1]) { // a > c ( forces b > c)
                                trueGameStandings = [playerB,
                                    playerA,
                                    playerC];
                                } else { // c > a
                                    if (gameThree[0] > gameThree[1]) { // b > c
                                        trueGameStandings = [playerB,
                                            playerC,
                                            playerA];
                                        } else { // c > b
                                            trueGameStandings = [playerC,
                                                playerB,
                                                playerA];
                                            }
                                        }
                                    }
                                    
                                    for (const game of match[1].games.entries()) {
                                        for (const result of game[1].results.entries()) {
                                            if (result[1].score == 0 && !sweepCase.includes(match[1])) {
                                                sweepCase.push(match[1]);
                                            }
                                        }
                                    }
                                    
                                    console.log(match[1]);
                                    for (const game of match[1].games.entries()) {
                                        console.log(game[1].id);
                                    }
                                    console.log(trueGameStandings);
                                }
                            }
                            for (const match of multiplayerMatches) {
                                console.log(match.id);
                            }
                            console.log("Total Matches : " + matches.size);
                            console.log("3 Player Matches : " + multiplayerMatches.length);
                            console.log("Swept matches : " + sweepCase.length);
                        }
                    }

function handleTwoPlayerMatch(
    matchNumber: string,
    p1Name: string, p1Score: string,
    p2Name: string, p2Score: string,
    eventId: string,
    timestamp: string,
    matchType: string
) {

    // Create a new match
    const match: MatchTemp = {
        id: matchNumber,
        competitive: matchType,
        games: [],
        timestamp: new Date(timestamp)
    };

    matches.set(matchNumber, match);
    events.get(eventId)?.matches.push(match);
    // Create a new game and result, add to match
    let p1Victories = parseInt(p1Score);
    let p2Victories = parseInt(p2Score);

    for (let i = 0; i < p1Victories + p2Victories;) {
        const g: GameTemp = { results: [] };
        match.games.push(g);

        let pWinner = 1;
        if (p1Victories > 0) {
            pWinner = 0;
            --p1Victories;
        }
        else
            --p2Victories;

        g.results.push({
            player: p1Name,
            rank: pWinner + 1
        });
        g.results.push({
            player: p2Name,
            rank: (pWinner * -1) + 2
        });
        
    }
}

function handleThreePlayerMatch(
    matches: string[][],
    eventId: string
) {
    const results = new Map<string, number[]>();
    const players = new Set<string>();

    let gameCount = 0;
    matches.forEach(m => {
        const v0 = m.slice(1, 5);
        const f = [[v0[0], v0[1]], [v0[3], v0[2]]].sort();
        const names = f[0][0] + "|" + f[1][0];
        const scores = [f[0][1], f[1][1]].map(x => parseInt(x));
        if (!gameCount)
            gameCount = scores[0] + scores[1];
        results.set(names, scores);
        players.add(f[0][0]);
        players.add(f[1][0]);
    });

    const games = [];
    for (let i = 0; i < gameCount; ++i)
        games.push([]);

    let emptyGame = 0;

    let populated = false;

    while (!populated) {
        const values = new Map<string, number>();
        const pairs = [...results.keys()].sort();
        const scores = pairs.map(p => results.get(p) || [0, 0]);

        players.forEach(p => values.set(p, 1));

        for (let i = 0; i < pairs.length; ++i) {
            const p = pairs[i].split("|");
            const s = scores[i] || 0;
            for (let j = 0; j < 2; ++j) {
                const v = values.get(p[j]) || 0;
                values.set(p[j], v * s[j]);
            }
        }
    }
}

function orgExists(searchInStrings: string[]): string | null {
  let finalOrg: string | null = null;
  const s = searchInStrings.join(" ");
  
  for (const org of organizations.values()) {
    for (const keyword of org.keywords) {

      // if keyword is exclusionary and we find it, break inner loop
      if (keyword[0] == '!' && s.search(keyword.substring(1)) != -1) {
        finalOrg = null;
        break;
      }
    
      else if (s.search(keyword) != -1)
        finalOrg = org.id;
    }

    if (finalOrg !== null)
      break;
  }

  return finalOrg;

}