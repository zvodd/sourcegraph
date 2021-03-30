// +build dist

package assets

import (
	_ "embed"
)

// We use Webpack manifest to extract hashed bundle names to serve to the client
// https://webpack.js.org/concepts/manifest/

//go:embed webpack.manifest.json
var webpackManifestJSON []byte
var (
	parseOnce      sync.Once
	parsedManifest *WebpackManifest
	parseErr       error
)

func LoadWebpackManifest() (m *WebpackManifest, err error) {
	parseOnce.Do(func() {
		if err := json.Unmarshal(webpackManifestJSON, &m); err != nil {
			parseErr = errors.Wrap(err, "parsing manifest json")
			return
		}
		parsedManifest = m
	})
	return parsedManifest, parseErr
}
