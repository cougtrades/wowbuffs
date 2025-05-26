const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { faction, oldBuff, newBuff } = JSON.parse(event.body);
        if (!faction || !oldBuff || !newBuff) {
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
        
        console.log('Received update request:', {
            faction,
            oldBuff,
            newBuff
        });
        
        // Find and update the buff with case-insensitive guild comparison and datetime normalization
        const buffIndex = currentContent.findIndex(buff => {
            // Normalize datetimes for comparison
            const buffDate = new Date(buff.datetime).toISOString();
            const oldBuffDate = new Date(oldBuff.datetime).toISOString();
            
            // First try exact match
            const exactMatch = buff.datetime === oldBuff.datetime && 
                buff.guild === oldBuff.guild && 
                buff.buff === oldBuff.buff;
            
            // If no exact match, try case-insensitive
            const caseInsensitiveMatch = buffDate === oldBuffDate && 
                buff.guild.toLowerCase() === oldBuff.guild.toLowerCase() && 
                buff.buff === oldBuff.buff;
            
            if (exactMatch || caseInsensitiveMatch) {
                console.log('Found matching buff:', buff);
                return true;
            }
            
            // Log the comparison for debugging
            console.log('Buff comparison:', {
                buff: {
                    datetime: buffDate,
                    guild: buff.guild,
                    buff: buff.buff
                },
                searchFor: {
                    datetime: oldBuffDate,
                    guild: oldBuff.guild,
                    buff: oldBuff.buff
                },
                matches: {
                    datetime: buffDate === oldBuffDate,
                    guild: buff.guild.toLowerCase() === oldBuff.guild.toLowerCase(),
                    buff: buff.buff === oldBuff.buff
                }
            });
            return false;
        });

        if (buffIndex === -1) {
            // Find all matching guild entries to help debug
            const matchingGuildEntries = currentContent.filter(buff => 
                buff.guild.toLowerCase() === oldBuff.guild.toLowerCase()
            );
            
            console.log('Buff not found. Looking for:', {
                datetime: oldBuff.datetime,
                guild: oldBuff.guild,
                buff: oldBuff.buff
            });
            console.log('All entries for this guild:', matchingGuildEntries);
            
            return {
                statusCode: 404,
                body: JSON.stringify({ 
                    error: 'Buff not found',
                    searchCriteria: {
                        datetime: oldBuff.datetime,
                        guild: oldBuff.guild,
                        buff: oldBuff.buff
                    },
                    matchingGuildEntries: matchingGuildEntries
                })
            };
        }

        // Update the buff
        currentContent[buffIndex] = newBuff;
        currentContent.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        // Update file on GitHub
        const updateResponse = await fetch(`https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Update ${faction} buff: ${newBuff.guild} ${newBuff.buff}`,
                content: Buffer.from(JSON.stringify(currentContent, null, 4)).toString('base64'),
                sha: fileData.sha
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update file: ' + (await updateResponse.json()).message);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Buff updated successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 
