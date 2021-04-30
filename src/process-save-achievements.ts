/* eslint-disable @typescript-eslint/no-use-before-define */
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { getConnection } from './db/rds';
import { Input } from './sqs-event';

export default async (event, context): Promise<any> => {
	const events: readonly Input[] = (event.Records as any[])
		.map(event => JSON.parse(event.body))
		.reduce((a, b) => a.concat(b), []);

	const mysql = await getConnection();
	for (const ev of events) {
		await processEvent(ev, mysql);
	}
	await mysql.end();

	const response = {
		statusCode: 200,
		isBase64Encoded: false,
		body: null,
	};
	return response;
};

const processEvent = async (achievementStat: Input, mysql: ServerlessMysql) => {
	const escape = SqlString.escape;
	console.debug('handling event', achievementStat);
	await mysql.query(
		`
			INSERT INTO achievement_stat 
			(
				achievementId,
				cardId,
				creationDate,
				name,
				numberOfCompletions,
				type,
				userId,
				userMachineId,
				userName,
				reviewId
			)
			VALUES
			(
				${escape(achievementStat.achievementId)},
				${escape(achievementStat.cardId)},
				${escape(achievementStat.creationDate)},
				${escape(achievementStat.name)},
				${escape(achievementStat.numberOfCompletions)},
				${escape(achievementStat.type)},
				${escape(achievementStat.userId)},
				${escape(achievementStat.userMachineId)},
				${escape(achievementStat.userName)},
				${escape(achievementStat.reviewId)}
			)
		`,
	);
};
