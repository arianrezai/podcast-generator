const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const s3Client = new S3Client();
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const pollyClient = new PollyClient();

// Function to truncate text to approximately 1 minute of speech
function truncateToOneMinute(text, wordsPerMinute = 150) {
  const words = text.split(/\s+/);
  return words.slice(0, wordsPerMinute).join(' ');
}

// Function to sanitize file name for Bedrock
function sanitizeFileName(fileName) {
  // Replace any non-alphanumeric characters (except allowed ones) with spaces
  let sanitized = fileName.replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, ' ');
  // Replace multiple consecutive spaces with a single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  // Trim spaces from the beginning and end
  return sanitized.trim();
}

exports.handler = async (event) => {
  try {
    // Get the uploaded file details from the S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Read the document from S3
    const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const document = await s3Client.send(getObjectCommand);

    // Determine the file type and process accordingly
    if (key.endsWith('.txt')) {
      // Process TXT file
      const documentContent = await document.Body.transformToString();
      await generatePodcastScript(bucket, key, documentContent);
    } else if (key.endsWith('.pdf')) {
      // Process PDF file
      const documentBytes = await document.Body.transformToByteArray();
      await generatePodcastScriptFromPDF(bucket, key, documentBytes);
    } else {
      // Unsupported file type
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Unsupported file type' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Podcast snippet generated successfully' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error generating podcast snippet', error: error.message }),
    };
  }
};

async function generatePodcastScript(bucket, key, documentContent) {
  // Generate podcast script using Bedrock with Claude 3 Sonnet
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: `Generate a short podcast script (about 1 minute when spoken) based on the following document: ${documentContent}\n\nProvide a concise, engaging introduction to the main points of the document. No preamble.`
          }
        ]
      }
    ]
  });

  const response = await bedrockClient.send(command);
  let podcastScript = response.output.message.content[0].text;

  // Truncate the script to approximately 1 minute of speech
  podcastScript = truncateToOneMinute(podcastScript);

  // Convert script to audio using Polly
  await generateAudioAndSaveToS3(bucket, key, podcastScript);
}

async function generatePodcastScriptFromPDF(bucket, key, documentBytes) {
  // Sanitize the file name for Bedrock
  const fileName = sanitizeFileName(key);

  // Generate podcast script using Bedrock with Claude 3 Sonnet
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            document: {
              name: fileName,
              format: "pdf",
              source: {
                bytes: documentBytes
              }
            }
          },
          {
            text: "Generate a short podcast script (about 1 minute when spoken) based on this document. Provide a concise, engaging introduction to the main points. No preamble."
          }
        ]
      }
    ]
  });

  const response = await bedrockClient.send(command);
  let podcastScript = response.output.message.content[0].text;

  // Truncate the script to approximately 1 minute of speech
  podcastScript = truncateToOneMinute(podcastScript);

  // Convert script to audio using Polly
  await generateAudioAndSaveToS3(bucket, key, podcastScript);
}

async function generateAudioAndSaveToS3(bucket, key, podcastScript) {
  // Convert script to audio using Polly
  const pollyParams = {
    Engine: 'neural',
    LanguageCode: 'en-US',
    OutputFormat: 'mp3',
    Text: podcastScript,
    VoiceId: 'Matthew',
    TextType: 'text',
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
}