/* eslint-disable @typescript-eslint/no-use-before-define */
import { getConnectionProxy } from '@firestone-hs/aws-lambda-utils';
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { Input } from './sqs-event';

export default async (event, context): Promise<any> => {
	const events: readonly Input[] = (event.Records as any[])
		.map((event) => JSON.parse(event.body))
		.reduce((a, b) => a.concat(b), []);

	console.debug('processing', events.length);
	const mysql = await getConnectionProxy();
	await processEvents(events, mysql);
	await mysql.end();

	const response = {
		statusCode: 200,
		isBase64Encoded: false,
		body: null,
	};
	return response;
};

const processEvents = async (achievementStats: readonly Input[], mysql: ServerlessMysql) => {
	const escape = SqlString.escape;
	// console.debug('handling events');

	const values = achievementStats
		.map(
			(stat) => `(
        ${escape(stat.achievementId)},
        ${escape(stat.cardId)},
        ${escape(stat.creationDate)},
        ${escape(stat.name)},
        ${escape(stat.numberOfCompletions)},
        ${escape(stat.type)},
        ${escape(stat.userId)},
        ${escape(stat.userMachineId)},
        ${escape(stat.userName)},
        ${escape(stat.reviewId)}
    )`,
		)
		.join(',');

	const query = `
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
        VALUES ${values}
    `;

	await mysql.query(query);
};
