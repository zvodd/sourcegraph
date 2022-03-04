module Types exposing (..)

import Json.Decode as Decode exposing (Decoder, fail, field, maybe, string)
import Json.Decode.Pipeline exposing (optional, required)



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
