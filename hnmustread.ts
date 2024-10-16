const itemsStoreName = "items-read";

// update this version any time there's a schema change
const dbOpenReq = globalThis.indexedDB.open("hnmr", 5);
dbOpenReq.onsuccess = () => {
  // try to init once and then on each pageshow
  // pageshow lets us hook into a user going "back" to the page
  window.addEventListener("pageshow", () => init().catch(console.error));
  init().catch(console.error);
};

// upgrade is the only place you can modify the schema
dbOpenReq.onupgradeneeded = () => {
  const db = dbOpenReq.result;
  // we "upgrade" by wiping; who cares
  if (db.objectStoreNames.contains(itemsStoreName)) {
    db.deleteObjectStore(itemsStoreName);
  }
  const objStore = db.createObjectStore(itemsStoreName);
  objStore.createIndex("read_at", "read_at", { unique: false });
};

const objectStoreRw = () => {
  // really we could have read, write, and readwrite but this is easier for now.
  return dbOpenReq.result
    .transaction([itemsStoreName], "readwrite")
    .objectStore(itemsStoreName);
};

// check if there's a post item that has been read (i.e. it is set in the db)
const checkReadPost = (item: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const getReq = objectStoreRw().get(item);
    getReq.onsuccess = () => {
      resolve(getReq.result !== undefined);
    };
    getReq.onerror = () => {
      reject(getReq.error);
    };
  });
};

// mark the post as read in the db as of right now
const didReadPost = (item: string) => {
  objectStoreRw().put({ read_at: new Date() }, item);
};

const init = async () => {
  // delete old posts read
  const oneWeekBefore = new Date();
  oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
  const deleteOldReq = objectStoreRw()
    .index("read_at")
    .openCursor(IDBKeyRange.upperBound(oneWeekBefore));
  deleteOldReq.onsuccess = () => {
    const cursor = deleteOldReq.result;
    if (!cursor) {
      return;
    }
    cursor.delete();
    cursor.continue();
  };
  deleteOldReq.onerror = () => {
    console.error("error clearing old items", deleteOldReq.error);
  };

  // disable unchecked posts
  document
    .querySelectorAll('.subline a[href^="item?"]')
    .forEach(async (node: Element) => {
      if (!(node instanceof HTMLAnchorElement)) {
        return;
      }
      const nodeUrl = new URL(node.href);
      const id = nodeUrl.searchParams.get("id");
      if (id === null) {
        return;
      }
      if (await checkReadPost(id)) {
        return;
      }
      node.setAttribute("hnmr-id", id);
      node.setAttribute("hnmr-href", node.href);
      node.href = "javascript:alert('go read the post first')";
    });

  // listen for clicks on unchecked posts
  document.querySelectorAll(".titleline > a").forEach(async (node: Element) => {
    if (!(node instanceof HTMLAnchorElement)) {
      return;
    }
    const id = node.closest("tr")?.id;
    if (id === undefined) {
      return;
    }
    if (await checkReadPost(id)) {
      return;
    }
    node.addEventListener("click", () => {
      didReadPost(id);
      document
        .querySelectorAll(`.subline a[hnmr-href][hnmr-id="${id}"]`)
        .forEach((node: Element) => {
          if (!(node instanceof HTMLAnchorElement)) {
            return;
          }
          const hnmrHref = node.getAttribute("hnmr-href");
          if (hnmrHref !== null) {
            node.href = hnmrHref;
          }
        });
    });
  });
};
