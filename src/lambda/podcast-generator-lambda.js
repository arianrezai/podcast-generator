const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const s3Client = new S3Client();
const bedrockClient = new BedrockRuntimeClient();
const pollyClient = new PollyClient();

// Function to truncate text to approximately 1 minute of speech
function truncateToOneMinute(text, wordsPerMinute = 150) {
  const words = text.split(/\s+/);
  return words.slice(0, wordsPerMinute).join(' ');
}

exports.handler = async (event) => {
  try {
    // Get the uploaded file details from the S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Read the document from S3
    const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const document = await s3Client.send(getObjectCommand);
    const documentContent = await document.Body.transformToString();

    // Generate podcast script using Bedrock with Claude 3 Sonnet
    const bedrockParams = {
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Generate a short podcast script (about 1 minute when spoken) based on the following document: ${documentContent}\n\nProvide a concise, engaging introduction to the main points of the document. No preamble.`
          }
        ]
      })
    };

    const invokeModelCommand = new InvokeModelCommand(bedrockParams);
    const bedrockResponse = await bedrockClient.send(invokeModelCommand);
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    let podcastScript = responseBody.content[0].text;

    // Truncate the script to approximately 1 minute of speech
    podcastScript = truncateToOneMinute(podcastScript);

    // Convert script to audio using Polly
    const pollyParams = {
      Engine: 'neural',
      LanguageCode: 'en-US',
      OutputFormat: 'mp3',
      Text: podcastScript,
      VoiceId: 'Matthew',
      TextType: 'text'
    };

    const synthesizeSpeechCommand = new SynthesizeSpeechCommand(pollyParams);
    const pollyResponse = await pollyClient.send(synthesizeSpeechCommand);

    // Save the audio file back to S3
    const audioKey = `${key.split('.')[0]}_podcast_snippet.mp3`;
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: audioKey,
      Body: await pollyResponse.AudioStream.transformToByteArray(),
      ContentType: 'audio/mpeg',
    });
    await s3Client.send(putObjectCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Podcast snippet generated successfully',
        audioKey,
        scriptPreview: podcastScript.substring(0, 100) + '...'
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error generating podcast snippet', error: error.message }),
    };
  }
};