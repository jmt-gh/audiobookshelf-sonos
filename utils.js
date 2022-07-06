const axios = require("axios");
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

    const { data } = await axios.get(path, config);
    return data;
  } catch (error) {
    console.log(`[getLibraryItems] Error caught. Error: ${error}`);
  }
}

async function getLibraryItem(libraryItemId) {
  try {
    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/items/${libraryItemId}`;

    const { data } = await axios.get(path, config);
    return data;
  } catch (error) {
    console.log(`[getLibraryItem] Error caught. Error: ${error}`);
  }
}

async function getABSProgress(libraryItemId) {
  try {
    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/me/progress/${libraryItemId}`;

    const { data } = await axios.get(path, config);
    return data;
  } catch (error) {
    console.log(`[getABSProgress] Error caught. Error: ${error}`);
  }
}

async function setProgress(updateObject, progress) {
  try {
    let libraryItemId = updateObject.libraryItemId;

    const config = {
      headers: { Authorization: `Bearer ${ABS_TOKEN}` },
    };

    let path = `${ABS_URI}/api/me/progress/${libraryItemId}`;

    const updateData = {
      duration: progress.bookDuration,
      currentTime: progress.progress,
      progress: progress.progress / progress.bookDuration,
    };

    //console.log('updateData', updateData)

    const { data } = await axios.patch(path, updateData, config);
  } catch (error) {
    console.log(`[getABSProgress] Error caught. Error: ${error}`);
  }
}

// Build the Objects
async function buildMediaURI(id) {
  let path = `${ABS_URI}/s/item/${id}?token=${ABS_TOKEN}`;

  return {
    getMediaURIResult: path,
  };
}

async function buildLibraryMetadataResult(res) {
  let libraryItems = res.results;
  let count = res.total;
  let total = count;
  let mediaMetadata = [];

  for (const libraryItem of libraryItems) {
    // https://developer.sonos.com/build/content-service-add-features/save-resume-playback/
    var mediaMetadataEntry = {
      itemType: "audiobook",
      id: libraryItem.id,
      mimeType: libraryItem.media.audioFiles[0].mimeType,
      canPlay: true,
      canResume: true,
      title: libraryItem.media.metadata.title,
      summary: libraryItem.media.metadata.description,
      authorId: libraryItem.media.metadata.authors[0].id,
      author: libraryItem.media.metadata.authors[0].name,
      narratorId: libraryItem.media.metadata.narrators[0].id,
      narrator: libraryItem.media.metadata.narrators[0].name,
      albumArtURI: `${ABS_URI}${libraryItem.media.coverPath}?token=${ABS_TOKEN}`,
    };

    mediaMetadata.push(mediaMetadataEntry);
  }

  // count and total HAVE to be correct, otherwise the sonos app falls over silently
  return {
    getMetadataResult: {
      count: count,
      total: total,
      index: 0,
      mediaCollection: mediaMetadata,
    },
  };
}

async function buildAudiobookTrackList(libraryItem, progressData) {
  let tracks = libraryItem.media.audioFiles;
  let icount = tracks.length;
  let itotal = tracks.length;
  let imediaMetadata = [];

  for (const track of tracks) {
    var mediaMetadataEntry = {
      id: `${libraryItem.id}/${track.metadata.filename}`,
      itemType: "track",
      title: track.metadata.filename,
      mimeType: track.mimeType,
      trackMetadata: {
        authorId: libraryItem.media.metadata.authors[0].id,
        author: libraryItem.media.metadata.authors[0].name,
        narratorId: libraryItem.media.metadata.narrators[0].id,
        narrator: libraryItem.media.metadata.narrators[0].name,
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
    positionInformation = {
      id: `${libraryItem.id}/${progressData.partName}`, // li_{string}/Part##.mp3
      index: 0,
      // 1) Sonos gets upset if there are too many decimals
      // 2) ABS returns everything in seconds, so multiple by 1000 for milliseconds for sonos
      offsetMillis: Math.round(progressData.relativeTimeForPart * 1000),
    };
  }

  return {
    getMetadataResult: {
      count: icount,
      total: itotal,
      index: 0,
      positionInformation: positionInformation,
      mediaMetadata: imediaMetadata,
    },
  };
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

  res.partName = audioFiles[closestIndex].metadata.filename;
  res.relativeTimeForPart =
    durations[closestIndex] == 0
      ? currentTime
      : Math.abs(currentTime - newDurationSums[closestIndex - 1]);

  return res;
}

async function buildProgress(libraryItem, updateObject) {
  let partId = updateObject.libraryItemIdAndFileName.split("/")[1]; // li_{string}/Part##.mp3
  let audioFiles = libraryItem.media.audioFiles;
  let res = {
    progress: updateObject.positionMillis / 1000, // abs tracks progress in seconds
    bookDuration: audioFiles
      .map((audioFile) => audioFile.duration)
      .reduce((result, item) => result + item),
  };

  for (const audioFile of audioFiles) {
    let filename = audioFile.metadata.filename;

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
  return await buildMediaURI(id);
}

async function getMetadataResult(libraryItemId) {
  if (libraryItemId == "root") {
    let libraryItems = await getLibraryItems();
    return await buildLibraryMetadataResult(libraryItems);
  } else {
    let libraryItem = await getLibraryItem(libraryItemId);

    // if there is existing progress, figure it out here and send it along
    let absProgress = await getABSProgress(libraryItemId);
    let progressData;
    if (absProgress) {
      progressData = partNameAndRelativeProgress(absProgress, libraryItem);
    }

    return await buildAudiobookTrackList(libraryItem, progressData);
  }
}

async function updateAudioBookshelfProgress(updateObject) {
  // 1. grab the library item
  // 2. sum up all parts prior to current from updateObject (grabing durations from step 1)
  // 3. add updateObject.positionMillis to sum from step 2

  let libraryItem = await getLibraryItem(updateObject.libraryItemId); // lets us get durations per part
  let progress = await buildProgress(libraryItem, updateObject);
  return await setProgress(updateObject, progress);
}

module.exports = {
  getMetadataResult,
  getMediaURI,
  updateAudioBookshelfProgress,
};
