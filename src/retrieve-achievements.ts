import SqlString from 'sqlstring';
import { gzipSync } from 'zlib';
import { getConnection } from './db/rds';

export default async (event): Promise<any> => {
	const mysql = await getConnection();
	const escape = SqlString.escape;
	const input = JSON.parse(event.body);

	const uniqueIdentifiersQuery = `
		SELECT DISTINCT userId, userName
		FROM user_mapping
		WHERE 
			userId = ${escape(input.userId)} 
			OR userName = ${input.userName ? escape(input.userName) : escape('__invalid__')}
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
		SELECT DISTINCT achievementId
		FROM achievement_stat
		WHERE 
			userName in (${userNamesCondition}) 
			OR userId in (${userIdCondition})
		ORDER BY achievementId
	`;
	const allAchievements: readonly any[] = await mysql.query(query);
	const results: readonly CompletedAchievement[] = allAchievements.map(result =>
		Object.assign(new CompletedAchievement(), {
			id: result.achievementId,
			numberOfCompletions: 1,
		} as CompletedAchievement),
	);
	// console.log(
	// 	'results',
	// 	results.filter(ach => ach.id.indexOf('global_mana_spent_') !== -1),
	// );
	await mysql.end();

	const stringResults = JSON.stringify({ results });
	const gzippedResults = gzipSync(stringResults).toString('base64');
	const response = {
		statusCode: 200,
		isBase64Encoded: true,
		body: gzippedResults,
		headers: {
			'Content-Type': 'text/html',
			'Content-Encoding': 'gzip',
		},
	};
	return response;
};

const isEmpty = (input: string) => !input || input.length === 0;

class CompletedAchievement {
	readonly id: string;
	readonly numberOfCompletions: number;
}
