/**
 * PUT a File to a GCS v4 signed write URL (browser → Google, no app server memory).
 * Configure Storage bucket CORS for your web origin or this will fail (status 0).
 */
export function putFileToSignedUrl(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(
        new Error(
          xhr.status === 0
            ? 'Upload blocked — configure Cloud Storage CORS on your bucket for this site origin (see server .env.example).'
            : `Upload failed (HTTP ${xhr.status}).`,
        ),
      )
    }
    xhr.onerror = () =>
      reject(
        new Error(
          'Network error while uploading. Confirm Storage CORS allows PUT from this origin.',
        ),
      )
    xhr.send(file)
  })
}
