package keyval

import (
	"crypto/md5"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"

	"github.com/goccy/go-json"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/syndtr/goleveldb/leveldb/util"
)

// *** Master Server ***

type ListResponse struct {
	Next string   `json:"next"`
	Keys []string `json:"keys"`
}

func (k *KeyVal) QueryHandler(key []byte, c fiber.Ctx) {
	m := c.Queries()

	if m["list-type"] == "2" {
		// this is an S3 style query
		// TODO: this is very incomplete
		key = []byte(string(key) + "/" + m["prefix"])
		iter := k.db.NewIterator(util.BytesPrefix(key), nil)
		defer iter.Release()

		ret := "<ListBucketResult>"
		for iter.Next() {
			rec := toRecord(iter.Value())
			if rec.Deleted != NO {
				continue
			}
			ret += "<Contents><Key>" + string(iter.Key()[len(key):]) + "</Key></Contents>"
		}
		ret += "</ListBucketResult>"
		c.Status(200)
		c.SendString(ret)
		return
	}

	// operation is first query parameter (e.g. ?list&limit=10)
	_, listOpOk := m["list"]
	_, unlinkedOpOk := m["unlinked"]

	if listOpOk || unlinkedOpOk {
		start := m["start"]
		limit := 0
		qlimit := m["limit"]
		if qlimit != "" {
			nlimit, err := strconv.Atoi(qlimit)
			if err != nil {
				c.Status(400)
				return
			}
			limit = nlimit
		}

		slice := util.BytesPrefix(key)
		if start != "" {
			slice.Start = []byte(start)
		}
		iter := k.db.NewIterator(slice, nil)
		defer iter.Release()
		keys := make([]string, 0)
		next := ""
		for iter.Next() {
			rec := toRecord(iter.Value())
			if (rec.Deleted != NO && listOpOk) ||
				(rec.Deleted != SOFT && unlinkedOpOk) {
				continue
			}
			if len(keys) > 1000000 { // too large (need to specify limit)
				c.Status(413)
				return
			}
			if limit > 0 && len(keys) == limit { // limit results returned
				next = string(iter.Key())
				break
			}
			keys = append(keys, string(iter.Key()))
		}
		str, err := json.Marshal(ListResponse{Next: next, Keys: keys})
		if err != nil {
			c.Status(500)
			return
		}
		c.Status(200)
		c.Set("Content-Type", "application/json")
		c.Send(str)
		return
	}

	c.Status(403)
}

func (k *KeyVal) Delete(key []byte, unlink bool) int {
	// delete the key, first locally
	rec := k.GetRecord(key)
	if rec.Deleted == HARD || (unlink && rec.Deleted == SOFT) {
		return 404
	}

	if !unlink && k.softDelete && rec.Deleted == NO {
		return 403
	}

	// mark as deleted
	if err := k.PutRecord(key, Record{SOFT, rec.Hash}); err != nil {
		k.log.Error("failed to put record", "error", err)
		return 500
	}

	if !unlink {
		if err := os.Remove(filepath.Join(k.volume, KeyToPath(key))); err != nil {
			k.log.Error("failed to delete file", "error", err)
			return 500
		}

		// this is a hard delete in the database, aka nothing
		k.db.Delete(key, nil)
	}

	// 204, all good
	return 204
}

func (k *KeyVal) Write(key []byte, value io.Reader, valueLen int64) int {
	// push to leveldb initially as deleted, and without a hash since we don't have it yet
	if err := k.PutRecord(key, Record{SOFT, ""}); err != nil {
		k.log.Error("failed to put record", "error", err)
		return 500
	}

	// If the file already exists, overwrite it. Otherwise create it and write to it.
	fp := filepath.Join(k.volume, KeyToPath(key))
	if err := os.MkdirAll(filepath.Dir(fp), 0755); err != nil {
		k.log.Error("failed to create directory", "error", err)
		return 500
	}

	f, err := os.OpenFile(fp, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		k.log.Error("failed to open file", "error", err)
		return 500
	}
	defer f.Close()

	h := md5.New()
	buf := make([]byte, 32*1024)
	if _, err := io.CopyBuffer(f, io.TeeReader(value, h), buf); err != nil {
		return 500
	}
	hash := fmt.Sprintf("%x", h.Sum(nil))

	// push to leveldb as existing
	if err := k.PutRecord(key, Record{NO, hash}); err != nil {
		k.log.Error("failed to put record", "error", err)
		return 500
	}

	// 201, all good
	return 201
}

func (k *KeyVal) ServeHTTP(c fiber.Ctx) error {
	url := c.Request().URI()
	method := c.Method()
	key := []byte(url.Path())
	m := c.Queries()
	lkey := []byte(url.Path())
	lkey = append(lkey, []byte(m["uploadId"])...)

	// this is a list query
	if len(url.QueryString()) > 0 && c.Method() == "GET" {
		k.QueryHandler(key, c)
		return nil
	}

	// lock the key while a PUT or DELETE is in progress
	if method == "POST" || method == "PUT" || method == "DELETE" || method == "UNLINK" {
		if !k.LockKey(lkey) {
			// conflict, retry later
			c.Status(409)
			return nil
		}
		defer k.UnlockKey(lkey)
	}

	switch method {
	case "GET", "HEAD":
		rec := k.GetRecord(key)
		var fp string
		if len(rec.Hash) != 0 {
			// note that the hash is always of the whole file, not the content requested
			c.Set("Content-Md5", rec.Hash)
		}
		if rec.Deleted == SOFT || rec.Deleted == HARD {
			c.Set("Content-Length", "0")
			c.Status(404)
			return nil
		}

		// check if the file exists
		if _, err := os.Stat(filepath.Join(k.volume, KeyToPath(key))); err != nil {
			c.Set("Content-Length", "0")
			c.Status(404)
			return nil
		}

		c.Status(200)
		if method == "GET" {
			fp = filepath.Join(k.volume, KeyToPath(key))
			c.SendFile(fp)
		}

	case "POST":
		// check if we already have the key, and it's not deleted
		rec := k.GetRecord(key)
		if rec.Deleted == NO {
			// Forbidden to overwrite with POST
			c.Status(403)
			return nil
		}

		// this will handle multipart uploads in "S3"
		if _, ok := m["uploads"]; ok {
			uploadid := uuid.New().String()
			k.uploadIDs[uploadid] = true

			// init multipart upload
			c.Status(200)
			c.Write([]byte(`<InitiateMultipartUploadResult>
        <UploadId>` + uploadid + `</UploadId>
      </InitiateMultipartUploadResult>`))
		} else if _, ok := m["delete"]; ok {
			del, err := parseDelete(c.Request().BodyStream())
			if err != nil {
				k.log.Error("failed to parse delete request", "error", err)
				c.Status(500)
				return nil
			}

			for _, subkey := range del.Keys {
				fullkey := fmt.Sprintf("%s/%s", key, subkey)
				status := k.Delete([]byte(fullkey), false)
				if status != 204 {
					c.Status(status)
					return nil
				}
			}
			c.Status(204)
		} else if uploadid, ok := m["uploadId"]; ok {
			if k.uploadIDs[uploadid] != true {
				c.Status(403)
				return nil
			}
			delete(k.uploadIDs, uploadid)

			// finish multipart upload
			cmu, err := parseCompleteMultipartUpload(c.Request().BodyStream())
			if err != nil {
				k.log.Error("failed to parse complete multipart upload request", "error", err)
				c.Status(500)
				return nil
			}

			// open all the part files
			var fs []io.Reader
			sz := int64(0)
			for _, part := range cmu.PartNumbers {
				fn := fmt.Sprintf("/tmp/%s-%d", uploadid, part)
				f, err := os.Open(fn)
				if err != nil {
					c.Status(403)
					return nil
				}
				if err := os.Remove(fn); err != nil {
					c.Status(500)
					return nil
				}
				defer f.Close()
				fi, _ := f.Stat()
				sz += fi.Size()
				fs = append(fs, f)
			}

			status := k.Write(key, io.MultiReader(fs...), sz)
			c.Status(status)
			c.SendString("<CompleteMultipartUploadResult></CompleteMultipartUploadResult>")
			return nil
		}

	case "PUT":
		// no empty values
		if c.Request().Header.ContentLength() == 0 {
			c.Status(411)
			return nil
		}

		// check if we already have the key, and it's not deleted
		if pn, ok := m["partNumber"]; ok {
			uploadid, ok := m["uploadId"]
			if !ok {
				c.Status(403)
				return nil
			} else if k.uploadIDs[uploadid] != true {
				c.Status(403)
				return nil
			}

			pnnum, _ := strconv.Atoi(pn)
			f, err := os.OpenFile(fmt.Sprintf("/tmp/%s-%d", uploadid, pnnum), os.O_RDWR|os.O_CREATE, 0600)
			if err != nil {
				c.Status(403)
				return nil
			}
			defer f.Close()
			buf := make([]byte, 32*1024)
			if _, err := io.CopyBuffer(f, c.Request().BodyStream(), buf); err != nil {
				c.Status(500)
				return nil
			}

			c.Status(200)
		} else {
			status := k.Write(key, c.Request().BodyStream(), int64(c.Request().Header.ContentLength()))
			c.Status(status)
		}

	case "DELETE":
		_, ok := m["unlink"]
		status := k.Delete(key, ok)
		c.Status(status)
	}

	return nil
}
