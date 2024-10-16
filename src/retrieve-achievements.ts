import { getConnectionReadOnly } from '@firestone-hs/aws-lambda-utils';
import SqlString from 'sqlstring';
import { gzipSync } from 'zlib';

export default async (event): Promise<any> => {
	const escape = SqlString.escape;
	if (!event.body?.length) {
		return {
			statusCode: 400,
			body: null,
			headers: {
				'Content-Type': 'text/html',
				'Content-Encoding': 'gzip',
			},
		};
	}

	const input = JSON.parse(event.body);

	const mysql = await getConnectionReadOnly();
	const userIds = await getAllUserIds(input.userId, input.userName, mysql);
	if (!userIds?.length) {
		await mysql.end();
		return {
			statusCode: 200,
			isBase64Encoded: false,
			body: JSON.stringify({ results: [] }),
		};
	}

	const query = `
		SELECT DISTINCT achievementId
		FROM achievement_stat
		WHERE userId IN (${escape(userIds)})
		ORDER BY achievementId
	`;
	const allAchievements: readonly any[] = await mysql.query(query);
	const results: readonly CompletedAchievement[] = allAchievements.map((result) =>
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

const getAllUserIds = async (userId: string, userName: string, mysql): Promise<readonly string[]> => {
	const escape = SqlString.escape;
	const userSelectQuery = `
			SELECT DISTINCT userId FROM user_mapping
			INNER JOIN (
				SELECT DISTINCT username FROM user_mapping
				WHERE 
					(username = ${escape(userName)} OR username = ${escape(userId)} OR userId = ${escape(userId)})
					AND username IS NOT NULL
					AND username != ''
					AND username != 'null'
					AND userId != ''
					AND userId IS NOT NULL
					AND userId != 'null'
			) AS x ON x.username = user_mapping.username
			UNION ALL SELECT ${escape(userId)}
		`;
	console.log('running query', userSelectQuery);
	const userIds: any[] = await mysql.query(userSelectQuery);
	console.log('query over', userIds);
	return userIds.map((result) => result.userId);
};

class CompletedAchievement {
	readonly id: string;
	readonly numberOfCompletions: number;
}
