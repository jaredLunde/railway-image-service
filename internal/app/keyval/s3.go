package keyval

import (
	"encoding/xml"
	"io"
)

type CompleteMultipartUpload struct {
	XMLName     xml.Name `xml:"CompleteMultipartUpload"`
	PartNumbers []int    `xml:"Part>PartNumber"`
}

type Delete struct {
	XMLName xml.Name `xml:"Delete"`
	Keys    []string `xml:"Object>Key"`
}

func parseXML(r io.Reader, dat interface{}) error {
	return xml.NewDecoder(r).Decode(dat)
}

func parseCompleteMultipartUpload(r io.Reader) (*CompleteMultipartUpload, error) {
	var cmu CompleteMultipartUpload
	if err := parseXML(r, &cmu); err != nil {
		return nil, err
	}
	return &cmu, nil
}

func parseDelete(r io.Reader) (*Delete, error) {
	var del Delete
	if err := parseXML(r, &del); err != nil {
		return nil, err
	}
	return &del, nil
}
