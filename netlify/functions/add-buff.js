const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { faction, newBuff } = JSON.parse(event.body);
        if (!faction || !newBuff) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing faction or buff data' })
            };
        }

        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        const path = faction === 'horde' ? 'horde_buffs.json' : 'alliance_buffs.json';

        // Fetch current file content and SHA
        const fileResponse = await fetch(`https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        const fileData = await fileResponse.json();
        if (!fileResponse.ok) {
            throw new Error('Failed to fetch file: ' + fileData.message);
        }

        const currentContent = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
        currentContent.push(newBuff);
        currentContent.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        // Update file on GitHub
        const updateResponse = await fetch(`https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Update ${path} with new buff`,
                content: Buffer.from(JSON.stringify(currentContent, null, 4)).toString('base64'),
                sha: fileData.sha
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update file: ' + (await updateResponse.json()).message);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Buff added successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
