const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const OWNER = 'coug';
const REPO = 'wowbuffs';
const BRANCH = 'main';

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { faction, oldBuff, newBuff } = JSON.parse(event.body);
    const fileName = `${faction}_buffs.json`;

    // Get the current content of the file
    const { data: fileData } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: fileName,
      ref: BRANCH
    });

    const content = Buffer.from(fileData.content, 'base64').toString();
    const buffs = JSON.parse(content);

    // Find and update the buff
    const buffIndex = buffs.findIndex(buff => 
      buff.datetime === oldBuff.datetime && 
      buff.guild === oldBuff.guild && 
      buff.buff === oldBuff.buff
    );

    if (buffIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Buff not found' })
      };
    }

    // Update the buff
    buffs[buffIndex] = newBuff;

    // Update the file on GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: fileName,
      message: `Update ${faction} buff: ${newBuff.guild} ${newBuff.buff}`,
      content: Buffer.from(JSON.stringify(buffs, null, 4)).toString('base64'),
      sha: fileData.sha,
      branch: BRANCH
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Buff updated successfully' })
    };
  } catch (error) {
    console.error('Error updating buff:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update buff' })
    };
  }
}; 