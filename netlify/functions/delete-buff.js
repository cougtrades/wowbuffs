const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { faction, buff } = JSON.parse(event.body);
        if (!faction || !buff) {
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
        
        // Create a function to normalize buff data for comparison
        const normalizeBuff = (b) => ({
            datetime: new Date(b.datetime).toISOString(),
            guild: b.guild.toLowerCase().trim(),
            buff: b.buff
        });

        // Find and remove the buff
        const searchBuff = normalizeBuff(buff);
        const buffIndex = currentContent.findIndex(b => {
            const normalizedBuff = normalizeBuff(b);
            return normalizedBuff.datetime === searchBuff.datetime &&
                   normalizedBuff.guild === searchBuff.guild &&
                   normalizedBuff.buff === searchBuff.buff;
        });

        if (buffIndex === -1) {
            // Find all matching guild entries to help debug
            const matchingGuildEntries = currentContent.filter(b => 
                b.guild.toLowerCase().trim() === buff.guild.toLowerCase().trim()
            );

            console.log('Buff not found. Looking for:', searchBuff);
            console.log('All entries for this guild:', matchingGuildEntries);

            return {
                statusCode: 404,
                body: JSON.stringify({ 
                    error: 'Buff not found',
                    searchCriteria: searchBuff,
                    matchingGuildEntries: matchingGuildEntries
                })
            };
        }

        // Remove the buff
        currentContent.splice(buffIndex, 1);

        // Update file on GitHub
        const updateResponse = await fetch(`https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Delete ${faction} buff: ${buff.guild} ${buff.buff}`,
                content: Buffer.from(JSON.stringify(currentContent, null, 4)).toString('base64'),
                sha: fileData.sha
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update file: ' + (await updateResponse.json()).message);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Buff deleted successfully' })
        };
    } catch (error) {
        console.error('Error in delete-buff:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 
