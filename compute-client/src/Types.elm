module Types exposing (..)

import Dict exposing (Dict)
import Json.Decode as Decode exposing (Decoder, fail, field, maybe, string)
import Json.Decode.Pipeline exposing (optional, required)



-- APP TYPES


type VisualKind
    = BarChart
    | Graph
    | Table
    | CSV
    | PlainData
    | ColorPalette
    | Notebook
    | Patch
    | ModifiedContent


type alias DataValue =
    { name : String
    , value : Float
    , update : Float -> Float -> Float
    }


type alias Filter a =
    { a
        | dataPoints : Int
        , sortByCount : Bool
        , reverse : Bool
        , excludeStopWords : Bool
    }


type alias Facet =
    { title : String
    , description : String
    , query : String

    -- rendering
    , visualKind : VisualKind
    , supportedVisualKinds : List VisualKind

    -- filter
    , dataPoints : Int
    , sortByCount : Bool
    , reverse : Bool
    , excludeStopWords : Bool

    -- data
    , resultsMap : Dict String DataValue
    }


exampleFacet : Facet
exampleFacet =
    { title = "title"
    , description = "description"
    , query = "empty"
    , visualKind = BarChart
    , supportedVisualKinds = [ BarChart ]
    , dataPoints = 30
    , sortByCount = True
    , reverse = False
    , excludeStopWords = False
    , resultsMap = Dict.empty
    }



-- STREAMING RESULT TYPES


type Result
    = Output TextResult
    | ReplaceInPlace TextResult


type alias TextResult =
    { value : String
    , repository : Maybe String
    , commit : Maybe String
    , path : Maybe String
    }



-- DECODERS


resultDecoder : Decoder Result
resultDecoder =
    field "kind" string
        |> Decode.andThen
            (\t ->
                case t of
                    "replace-in-place" ->
                        textResultDecoder
                            |> Decode.map ReplaceInPlace

                    "output" ->
                        textResultDecoder
                            |> Decode.map Output

                    _ ->
                        fail ("Unrecognized type " ++ t)
            )


textResultDecoder : Decoder TextResult
textResultDecoder =
    Decode.succeed TextResult
        |> required "value" string
        |> optional "repository" (maybe string) Nothing
        |> optional "commit" (maybe string) Nothing
        |> optional "path" (maybe string) Nothing
