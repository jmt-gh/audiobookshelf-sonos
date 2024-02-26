const axios = require("axios");
const logger = require("./logger");
var config = require("./config");

const ABS_TOKEN = config.ABS_TOKEN;
const ABS_URI = config.ABS_URI;
const ABS_LIBRARY_ID = config.ABS_LIBRARY_ID;

// Network Requests
async function getLibraryItems() {
  try {
    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/libraries/${ABS_LIBRARY_ID}/items`;
    logger.info("Fetching library item at:", path)

    const { data } = await axios.get(path, config);
    return data;
  } catch (error) {
    logger.error("Error fetching library items", error);
  }
}

async function getLibraryItem(libraryItemId) {
  try {
    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/items/${libraryItemId}`;
    logger.info("Fetching library item at:", path)

    const { data } = await axios.get(path, config);
    return data;
  } catch (error) {
    logger.error("Error fetching library item", error);
  }
}

async function getABSProgress(libraryItemId) {
  try {
    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/me/progress/${libraryItemId}`;
    logger.info("Fetching library item progress at:", path)

    const { data } = await axios.get(path, config);
    return data;
  } catch (error) {
    logger.error("Error fetching library item progress", error);
  }
}

async function setProgress(updateObject, progress) {
  try {
    let libraryItemId = updateObject.libraryItemId;

    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/me/progress/${libraryItemId}`;
    logger.info("Setting library item progress at:", path)

    const updateData = {
      duration: progress.bookDuration,
      currentTime: progress.progress,
      progress: progress.progress / progress.bookDuration,
    };

    logger.debug('updateData', updateData)

    const { data } = await axios.patch(path, updateData, config);
  } catch (error) {
    console.error("Error setting library item progress", error);
  }
}

// Build the Objects
async function buildMediaURI(id) {
  let path = `${ABS_URI}/api/items/${id}?token=${ABS_TOKEN}`
  logger.info('Building Media URI to fetch...', path)

  return {
    getMediaURIResult: path,
  };
}

async function buildLibraryMetadataResult(res, index = 0, count = 50) {
  let libraryItems = res.results;
  let mediaMetadata = [];

  // Sort alphabetically by title for now
  const sortedResults = libraryItems.sort((a, b) => a.media.metadata.title > b.media.metadata.title ? 1 : -1);

  // Sonos seems to have a limit at 100 items, if you use 101, it won't work anymore
  const pageContents = sortedResults.slice(index, index + count);

  for (const libraryItem of pageContents) {
     // https://developer.sonos.com/build/content-service-add-features/save-resume-playback/
     var mediaMetadataEntry = { 
       itemType: "audiobook",
       id: libraryItem.id,
       mimeType: libraryItem.media.audioFiles?.[0]?.mimeType ?? 'audio/mpeg', // audioFiles is only present if you request a single item
       canPlay: true,
       canResume: true,
       title: libraryItem.media.metadata.title ?? '',
       summary: '', // libraryItem.media.metadata.description ?? 'foo',
       //authorId: libraryItem.media.metadata.authors[0].id,
       author: libraryItem.media.metadata.authorName,
       //narratorId: libraryItem.media.metadata.narrators[0].id,
       narrator: libraryItem.media.metadata.narratorName,
       albumArtURI: `${ABS_URI}/api/items/${libraryItem.id}/cover?token=${ABS_TOKEN}`,
     };  

    // logger.debug("libraryItem for mediaMetadataEntry:", libraryItem)
    // logger.debug("mediaMetadataEntry:", mediaMetadataEntry)

     mediaMetadata.push(mediaMetadataEntry);
   }   

  // count and total HAVE to be correct, otherwise the sonos app falls over silently
  return {
    getMetadataResult: {
      count: mediaMetadata.length,
      total: res.results.length,
      index: 0,
      mediaCollection: mediaMetadata,
    },
  };
}

async function buildAudiobookTrackList(libraryItem, index, count, progressData) {
  let tracks = libraryItem.media.audioFiles;
  let imediaMetadata = [];

  // Sonos seems to have a limit at 100 items, if you use 101, it won't work anymore
  const pageSize = count ?? 50;
  const pageContents = tracks.slice(index, index + pageSize);

  for (const track of pageContents) {
    var mediaMetadataEntry = {
      id: `${libraryItem.media.libraryItemId}/file/${track.ino}`,
      itemType: "track",
      title: track.metadata.filename,
      mimeType: track.mimeType,
      trackMetadata: {
        authorId: libraryItem.media.metadata.authors[0].id,
        author: libraryItem.media.metadata.authors[0].name,
//      narratorId: libraryItem.media.metadata.narrators[0].id,
//      narrator: libraryItem.media.metadata.narrators[0].name,
        duration: track.duration,
        book: libraryItem.media.metadata.title,
        albumArtURI: `${ABS_URI}${libraryItem.media.coverPath}?token=${ABS_TOKEN}`,
        canPlay: true,
        canAddToFavorites: false,
      },
    };

    imediaMetadata.push(mediaMetadataEntry);
  }

  let positionInformation = {};
  if (progressData) {
    logger.info(`Progress data found from ABS for ${libraryItem.id}`)
    try {
      positionInformation = {
        id: `${libraryItem.id}/file/${progressData.partName}`, // UUID-ITEM-ID/12345
        index: 0,
        // 1) Sonos gets upset if there are too many decimals
        // 2) ABS returns everything in seconds, so multiple by 1000 for milliseconds for sonos
        offsetMillis: Math.round(progressData.relativeTimeForPart * 1000),
      };
      logger.debug("positionInformation for library item", positionInformation)
    } catch (error) {
      logger.error("Error trying to get progressData", error.message)
    }
  }

  const res = {
    getMetadataResult: {
      count: imediaMetadata.length,
      total: tracks.length,
      // total: 210,
      index: index,
      positionInformation: positionInformation,
      mediaMetadata: imediaMetadata,
    },
  };

  return res;
}

function partNameAndRelativeProgress(currentProgress, libraryItem) {
  // create an array of each parts "running sum" (the current part + all previous parts durations)
  // find which part the currentProgress exists in, and return that part name and how far along it we are
  let audioFiles = libraryItem.media.audioFiles;
  let durations = audioFiles.map((x) => x.duration);
  let currentTime = currentProgress.currentTime;
  let newDurationSums = [];
  let running = 0;

  let res = {
    partName: "",
    relativeTimeForPart: 0,
  };

  for (const duration of durations) {
    running += duration;
    newDurationSums.push(running);
  }

  let inThisPart;
  for (const duration of newDurationSums) {
    if (duration > currentTime) {
      inThisPart = duration;
      break;
    }
  }

  let closestIndex = newDurationSums.indexOf(inThisPart);

	logger.debug("newDurationSums", newDurationSums)
	logger.debug("closestIndex", closestIndex)
	logger.debug("newDuration[closestIndex]", newDurationSums[closestIndex])
	logger.debug("Maths", Math.abs(currentTime - newDurationSums[closestIndex - 1]))

  res.partName = audioFiles[closestIndex].ino;
  // durations[closestIndex] can never be 0, since it stores the duration of each track. that would only work if you have
  // an initial track that is 0 ms long
  // -> if you are in the first part, simply return the running time
  // -> if you are not in the first part, subtract the previous' parts total sums from currentTime to get the relative time
  //    in the current track
  res.relativeTimeForPart =
    closestIndex == 0
      ? currentTime
      : Math.abs(currentTime - newDurationSums[closestIndex - 1]);

  return res;
}

async function buildProgress(libraryItem, updateObject) {
  //let partId = updateObject.libraryItemIdAndFileName.split("/")[1]; // li_{string}/Part##.mp3
  let partId = updateObject.libraryItemIdAndFileName.split("/")[2]; // ITEM-UUID/file/12345 -> 12345
  logger.debug("partId", partId)

  let audioFiles = libraryItem.media.audioFiles;
  logger.debug("audioFiles", audioFiles)

  let res = {
    progress: updateObject.positionMillis / 1000, // abs tracks progress in seconds
    bookDuration: audioFiles
      .map((audioFile) => audioFile.duration)
      .reduce((result, item) => result + item),
  };
  logger.debug("res", res)

  for (const audioFile of audioFiles) {
    let filename = audioFile.ino;

    if (filename == partId) {
      // only grab as much duration as up to the part we are currently at
      break;
    }

    res.progress += audioFile.duration;
  }

  return res;
}

// Methods to invoke
async function getMediaURI(id) {
  logger.info("called with id", id)
  return await buildMediaURI(id);
}

async function getMetadataResult(libraryItemId, index, count) {
  if (libraryItemId == "root") {
    let libraryItems = await getLibraryItems(index);
    return await buildLibraryMetadataResult(libraryItems, index, count);
  } else {
    let libraryItem = await getLibraryItem(libraryItemId);

    // if there is existing progress, figure it out here and send it along
    let absProgress = await getABSProgress(libraryItemId);
    let progressData;
    if (absProgress) {
      logger.info("absProgress found! absProgress", absProgress)
      progressData = partNameAndRelativeProgress(absProgress, libraryItem);
      logger.debug("progressData from partNameAndRelativeProgress", progressData)
    }

    const res = await buildAudiobookTrackList(libraryItem, index, count, progressData);
    // logger.debug(JSON.stringify(res));
    return res;
  }
}

async function updateAudioBookshelfProgress(updateObject) {
  // 1. grab the library item
  // 2. sum up all parts prior to current from updateObject (grabing durations from step 1)
  // 3. add updateObject.positionMillis to sum from step 2
  logger.info("Updating audiobook progress...")
  let libraryItem = await getLibraryItem(updateObject.libraryItemId); // lets us get durations per part
  let progress = await buildProgress(libraryItem, updateObject);
  return await setProgress(updateObject, progress);
}

module.exports = {
  getMetadataResult,
  getMediaURI,
  updateAudioBookshelfProgress,
};
