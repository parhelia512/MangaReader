import {
  all,
  put,
  take,
  fork,
  call,
  select,
  takeLatest,
  takeEvery,
  delay,
} from 'redux-saga/effects';
import { storageKey, fetchData, handleBookshelf, handleManga, handleChapter } from '~/utils';
import { action } from './slice';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {
  launch,
  launchCompletion,
  syncData,
  syncDataCompletion,
  syncFavorites,
  syncDict,
  clearCache,
  viewChapter,
  viewPage,
  addFavorites,
  removeFavorites,
  loadSearch,
  loadSearchCompletion,
  loadUpdate,
  loadUpdateCompletion,
  loadManga,
  loadMangaCompletion,
  loadChapter,
  loadChapterCompletion,
} = action;

function* launchSaga() {
  yield takeLatest(launch.type, function* () {
    yield put(syncData());
    yield take(syncDataCompletion.type);

    yield put(launchCompletion({ error: undefined }));
  });
}
function* syncDataSaga() {
  yield takeLatest(syncData.type, function* () {
    try {
      const favoritesData: string | null = yield call(AsyncStorage.getItem, storageKey.favorites);
      const dictData: string | null = yield call(AsyncStorage.getItem, storageKey.dict);

      let favorites: string[] = [];
      let dict: RootState['dict'] = { manga: {}, chapter: {} };
      if (favoritesData) {
        favorites = JSON.parse(favoritesData);
      }
      if (dictData) {
        dict = JSON.parse(dictData);
      }

      yield put(syncFavorites(favorites));
      yield put(syncDict(dict));
      yield put(syncDataCompletion({ error: undefined }));
    } catch (e) {
      yield put(syncDataCompletion({ error: new Error('launch fail') }));
    }
  });
}
function* storageDataSaga() {
  yield takeLatest(
    [
      viewChapter.type,
      viewPage.type,
      addFavorites.type,
      removeFavorites.type,
      loadSearchCompletion.type,
      loadUpdateCompletion.type,
      loadMangaCompletion.type,
      loadChapterCompletion.type,
    ],
    function* () {
      yield delay(2000);
      const favorites = ((state: RootState) => state.favorites)(yield select());
      const dict = ((state: RootState) => state.dict)(yield select());

      yield call(AsyncStorage.setItem, storageKey.favorites, JSON.stringify(favorites));
      yield call(AsyncStorage.setItem, storageKey.dict, JSON.stringify(dict));
    }
  );
}
function* clearCacheSaga() {
  yield takeLatest([clearCache.type], function* () {
    yield call(AsyncStorage.clear);
  });
}

function* loadSearchSaga() {
  yield takeLatest(loadSearch.type, function* () {
    const { keyword, page, isEnd } = ((state: RootState) => state.search)(yield select());

    if (isEnd) {
      yield put(loadSearchCompletion({ error: new Error('已经到底了!') }));
      return;
    }

    const body = new FormData();
    body.append('key', keyword);
    body.append('page', String(page));
    body.append('ajax', '1');
    body.append('order', '1');

    const { error, data } = yield call(fetchData, {
      url: `https://m.manhuagui.com/s/${keyword}.html/`,
      method: 'POST',
      body: page > 1 ? body : undefined,
    });

    yield put(loadSearchCompletion({ error, data: handleBookshelf(data) }));
  });
}

function* loadUpdateSaga() {
  yield takeLatest(loadUpdate.type, function* () {
    const { page, isEnd } = ((state: RootState) => state.update)(yield select());

    if (isEnd) {
      yield put(loadUpdateCompletion({ error: new Error('已经到底了!') }));
      return;
    }

    const { error, data } = yield call(fetchData, {
      url: 'https://m.manhuagui.com/update/',
      body: {
        page,
        ajax: 1,
        order: 1,
      },
    });

    yield put(loadUpdateCompletion({ error, data: handleBookshelf(data) }));
  });
}

function* loadMangaSaga() {
  yield takeEvery(loadManga.type, function* () {
    const { mangaId } = ((state: RootState) => state.manga)(yield select());

    const { error, data } = yield call(fetchData, {
      url: 'https://m.manhuagui.com/comic/' + mangaId,
    });
    const manga = handleManga(data);

    yield put(loadMangaCompletion({ error, data: { ...manga, id: mangaId } }));
  });
}

function* loadChapterSaga() {
  yield takeEvery(loadChapter.type, function* () {
    const { mangaId, chapterId } = ((state: RootState) => state.chapter)(yield select());
    const { error, data } = yield call(fetchData, {
      url: `https://m.manhuagui.com/comic/${mangaId}/${chapterId}.html`,
    });

    yield put(loadChapterCompletion({ error, data: handleChapter(data) }));
  });
}

export default function* rootSaga() {
  yield all([
    fork(launchSaga),
    fork(syncDataSaga),
    fork(storageDataSaga),
    fork(clearCacheSaga),
    fork(loadSearchSaga),
    fork(loadUpdateSaga),
    fork(loadMangaSaga),
    fork(loadChapterSaga),
  ]);
}
