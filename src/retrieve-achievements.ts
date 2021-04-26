import SqlString from 'sqlstring';
import { gzipSync } from 'zlib';
import { getConnection } from './db/rds';

export default async (event): Promise<any> => {
	const mysql = await getConnection();
	console.log('input', JSON.stringify(event));
	const escape = SqlString.escape;
	const userInfo = JSON.parse(event.body);
	console.log('getting stats for user', userInfo);

	const uniqueIdentifiersQuery = `
			SELECT DISTINCT userName, userId 
			FROM achievement_stat
			WHERE userName = ${escape(userInfo.userName || '__invalid__')}
				OR userId = ${escape(userInfo.userId || '__invalid__')}
		`;
	const uniqueIdentifiers: readonly any[] = await mysql.query(uniqueIdentifiersQuery);

	const userNamesCondition = uniqueIdentifiers.map(id => "'" + id.userName + "'").join(',');
	const userIdCondition = uniqueIdentifiers.map(id => "'" + id.userId + "'").join(',');
	if (isEmpty(userNamesCondition) || isEmpty(userIdCondition)) {
		return {
			statusCode: 200,
			isBase64Encoded: false,
			body: JSON.stringify({ results: [] }),
		};
	}

	const query = `
			SELECT achievementId, max(numberOfCompletions) AS numberOfCompletions 
			FROM achievement_stat
			WHERE userName in (${userNamesCondition}) OR userId in (${userIdCondition})
			GROUP BY achievementId
			ORDER BY achievementId
		`;
	console.log('running query', query);
	const allAchievements: readonly any[] = await mysql.query(query);
	const results: readonly CompletedAchievement[] = allAchievements.map(result =>
		Object.assign(new CompletedAchievement(), {
			id: result.achievementId,
			numberOfCompletions: result.numberOfCompletions,
		} as CompletedAchievement),
	);
	console.log(
		'results',
		results.filter(ach => ach.id.indexOf('global_mana_spent_') !== -1),
	);
	await mysql.end();
	// console.log('results', results);

	const stringResults = JSON.stringify({ results });
	const gzippedResults = gzipSync(stringResults).toString('base64');
	console.log('compressed', stringResults.length, gzippedResults.length);
	const response = {
		statusCode: 200,
		isBase64Encoded: true,
		body: gzippedResults,
		headers: {
			'Content-Type': 'text/html',
			'Content-Encoding': 'gzip',
		},
	};
	// console.log('sending back success reponse');
	return response;
};

const isEmpty = (input: string) => !input || input.length === 0;

class CompletedAchievement {
	readonly id: string;
	readonly numberOfCompletions: number;
}
