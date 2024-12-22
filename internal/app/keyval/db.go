package keyval

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	NO = iota
	SOFT
	HARD
)

type Record struct {
	Deleted int
	Hash    string
}

func toRecord(data []byte) Record {
	var rec Record
	ss := string(data)
	rec.Deleted = NO
	if strings.HasPrefix(ss, "DELETED") {
		rec.Deleted = SOFT
		ss = ss[7:]
	}
	if strings.HasPrefix(ss, "HASH") {
		rec.Hash = ss[4:36]
	}
	return rec
}

func fromRecord(rec Record) ([]byte, error) {
	cc := ""
	if rec.Deleted == HARD {
		return nil, fmt.Errorf("cannot put HARD delete in the database")
	}
	if rec.Deleted == SOFT {
		cc = "DELETED"
	}
	if len(rec.Hash) == 32 {
		cc += "HASH" + rec.Hash
	}
	return []byte(cc), nil
}

func KeyToPath(key []byte) string {
	mkey := md5.Sum(key)
	hexkey := hex.EncodeToString(key)
	// 2 byte layers deep, meaning a fanout of 256
	// optimized for 2^24 = 16M files in the volume
	return fmt.Sprintf("/%02x/%02x/%s", mkey[0], mkey[1], hexkey)
}
