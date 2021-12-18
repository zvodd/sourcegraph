module ExampleData exposing (..)

import Dict exposing (Dict)
import Gen.Route exposing (Route)
import Types exposing (..)


queryPlaceholder : String
queryPlaceholder =
    "repo:sourcegraph/sourcegraph content:output(#([a-fA-F0-9]{6})[^a-fA-F0-9] -> $1)"


facetPlaceholder : String -> Facet
facetPlaceholder title =
    { query = queryPlaceholder
    , title = title
    , description = "description"
    , visualKind = Table
    , supportedVisualKinds = []
    , dataPoints = 30
    , sortByCount = True
    , reverse = False
    , excludeStopWords = False
    , resultsMap = resultsMap
    }


resultsMap : Dict String DataValue
resultsMap =
    [ { name = "Errorf"
      , value = 10.0
      , update = (+)
      }
    , { name = "Func\nmulti\nline"
      , value = 5.0
      , update = (+)
      }
    , { name = "Qux"
      , value = 2.0
      , update = (+)
      }
    ]
        |> List.map (\d -> ( d.name, d ))
        |> Dict.fromList


resultsRaw : List Types.Result
resultsRaw =
    [ ReplaceInPlace
        { value = """diff --git a/client/web/dev/server/development.server.ts b/client/web/dev/server/development.server.ts
index 26c5331d62..d5653e66c3 100644
--- a/client/web/dev/server/development.server.ts
+++ b/client/web/dev/server/development.server.ts
@@ -83,6 +83,11 @@ async function startWebpackDevelopmentServer({
     }
 
     const developmentServerConfig: WebpackDevServer.Configuration = {
+               headers: {
+                 "Access-Control-Allow-Origin": "*",
+                 "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
+                 "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
+               },
         // react-refresh plugin triggers page reload if needed.
         liveReload: false,
         allowedHosts: 'all',"""
        , repository = Just "repo"
        , commit = Just "HEAD"
        , path = Just "/an/awesome/path"
        }
    ]
