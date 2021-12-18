module Pages.Create exposing (Model, Msg(..), SubmitAction(..), init, inputRow, page, subscriptions, update, view)

import Dict exposing (Dict)
import Effect exposing (Effect)
import Element as E exposing (..)
import Element.Font as F
import Element.Input as I
import ExampleData
import Gen.Params.Create exposing (Params)
import Json.Decode as Decode
import Page
import Process
import Request
import Shared exposing (Msg)
import Stream
import Styling exposing (..)
import Task
import Types exposing (..)
import Url.Builder
import View exposing (View)
import ViewData


page : Shared.Model -> Request.With Params -> Page.With Model Msg
page _ _ =
    Page.advanced
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }



-- CONSTANTS


debounceQueryMillis : Float
debounceQueryMillis =
    400


endpoint : String
endpoint =
    "https://sourcegraph.test:3443"



-- MODEL


type SubmitAction
    = Create
    | Update Int


type alias Model =
    { -- User inputs : data
      title : String
    , description : String
    , query : String

    -- Rendering
    , visualKind : VisualKind
    , supportedVisualKinds : List VisualKind

    -- User inputs : filter
    , dataPoints : Int
    , sortByCount : Bool
    , reverse : Bool
    , excludeStopWords : Bool

    -- Persisted data
    , resultsMap : Dict String DataValue

    -- Submit action
    , submitAction : SubmitAction

    -- Temporary data on this page
    , resultsRaw : List Types.Result

    -- State changes
    , queryModifiedSinceLastRequest : Bool
    , millisSinceChange : Int
    , debounce : Int

    -- Debug client
    , serverless : Bool
    }



-- INIT


init : ( Model, Effect Msg )
init =
    ( { title = "stahp"
      , description = "description"
      , query = "repo:sourcegraph/sourcegraph$ content:output((\\w+) -> $1) type:commit after:\"4 months ago\" count:all"
      , visualKind = BarChart
      , supportedVisualKinds = [ ColorPalette ]
      , dataPoints = 30
      , sortByCount = True
      , reverse = False
      , excludeStopWords = True
      , resultsMap = Dict.empty
      , submitAction = Create
      , resultsRaw = []
      , queryModifiedSinceLastRequest = False
      , millisSinceChange = 0
      , debounce = 0
      , serverless = False
      }
    , Effect.fromCmd (Task.perform identity (Task.succeed RunCompute))
    )



-- UPDATE


type alias ExampleMsg =
    { query : String
    , visualKind : VisualKind
    , sortByCount : Bool
    , reverse : Bool
    , excludeStopWords : Bool
    }


type Msg
    = OnQueryChanged String
    | OnDataPoints String
    | OnSortByCheckbox Bool
    | OnReverseCheckbox Bool
    | OnExcludeStopWordsCheckbox Bool
    | OnExampleClicked ExampleMsg
    | OnTabSelected VisualKind
    | OnDebounce
    | RunCompute
    | OnResults (List Types.Result)
    | ResultStreamDone
    | NoOp


update : Msg -> Model -> ( Model, Effect Msg )
update msg model =
    case msg of
        OnQueryChanged query ->
            ( { model | query = query, debounce = model.debounce + 1, queryModifiedSinceLastRequest = True }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        OnDataPoints i ->
            let
                updateN =
                    case String.toInt i of
                        Just newN ->
                            newN

                        Nothing ->
                            0
            in
            ( { model | dataPoints = updateN }, Effect.none )

        OnSortByCheckbox sortByCount ->
            ( { model | sortByCount = sortByCount }, Effect.none )

        OnReverseCheckbox reverse ->
            ( { model | reverse = reverse }, Effect.none )

        OnExcludeStopWordsCheckbox excludeStopWords ->
            ( { model | excludeStopWords = excludeStopWords }, Effect.none )

        RunCompute ->
            let
                _ =
                    Debug.log "Run compute: query" model.query
            in
            if model.serverless then
                ( { model | queryModifiedSinceLastRequest = False, resultsRaw = ExampleData.resultsRaw, resultsMap = ExampleData.resultsMap }, Effect.none )

            else
                ( { model | queryModifiedSinceLastRequest = False, resultsRaw = [], resultsMap = Dict.empty }
                , Effect.fromCmd
                    (Stream.openStream
                        ( endpoint
                            ++ Url.Builder.absolute [ "compute", "stream" ]
                                [ Url.Builder.string "q" model.query ]
                        , Nothing
                        )
                    )
                )

        OnResults r ->
            let
                _ =
                    Debug.log "saw done event"
            in
            ( { model
                | resultsRaw = model.resultsRaw ++ r
                , resultsMap =
                    -- Aggregate in dictionary
                    parseResults r
                        |> List.foldl updateChartData model.resultsMap
              }
            , Effect.none
            )

        ResultStreamDone ->
            ( model, Effect.none )

        OnDebounce ->
            if model.debounce - 1 == 0 then
                update RunCompute { model | debounce = model.debounce - 1 }

            else
                ( { model | debounce = model.debounce - 1 }, Effect.none )

        OnTabSelected kind ->
            ( { model | visualKind = kind }, Effect.none )

        OnExampleClicked { query, visualKind, sortByCount, reverse, excludeStopWords } ->
            ( { model
                | query = query
                , visualKind = visualKind
                , sortByCount = sortByCount
                , reverse = reverse
                , excludeStopWords = excludeStopWords
              }
            , Effect.none
            )
                |> Tuple.first
                |> update RunCompute

        NoOp ->
            ( model, Effect.none )



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch [ Stream.receiveEvent eventDecoder ]


eventDecoder : Stream.RawEvent -> Msg
eventDecoder event =
    case event.eventType of
        Just "results" ->
            OnResults (resultEventDecoder event.data)

        Just "done" ->
            let
                _ =
                    Debug.log "saw done event"
            in
            ResultStreamDone

        Just e ->
            let
                _ =
                    Debug.log "unhandled event" e
            in
            NoOp

        Nothing ->
            NoOp


resultEventDecoder : String -> List Types.Result
resultEventDecoder input =
    case Decode.decodeString (Decode.list resultDecoder) input of
        Ok results ->
            results

        Err e ->
            let
                _ =
                    Debug.log "error decoding result" e
            in
            []



-- VIEW


view : Model -> View Msg
view model =
    { title = "Compute | Create Facet"
    , element =
        column [ E.width E.fill, E.paddingXY 250 100, E.below exampleList ]
            [ inputRow model
            , ViewData.tabbedView [ BarChart, Table, PlainData, ColorPalette ]
                OnTabSelected
                model.visualKind
                model
                model.resultsMap
            ]
    }


inputRow : Model -> E.Element Msg
inputRow model =
    el [ centerX, width fill ]
        (column [ width fill ]
            [ I.text []
                { onChange = OnQueryChanged
                , placeholder = Nothing
                , text = model.query
                , label = I.labelHidden ""
                }
            , row [ paddingXY 0 10 ]
                [ I.text [ width (fill |> maximum 65), F.center ]
                    { onChange = OnDataPoints
                    , placeholder = Nothing
                    , text =
                        case model.dataPoints of
                            0 ->
                                ""

                            n ->
                                String.fromInt n
                    , label = I.labelHidden ""
                    }
                , I.checkbox [ paddingXY 10 0 ]
                    { onChange = OnSortByCheckbox
                    , icon = I.defaultCheckbox
                    , checked = model.sortByCount
                    , label = I.labelRight [] (text "sort by count")
                    }
                , I.checkbox [ paddingXY 10 0 ]
                    { onChange = OnReverseCheckbox
                    , icon = I.defaultCheckbox
                    , checked = model.reverse
                    , label = I.labelRight [] (E.text "reverse")
                    }
                , I.checkbox [ E.paddingXY 10 0 ]
                    { onChange = OnExcludeStopWordsCheckbox
                    , icon = I.defaultCheckbox
                    , checked = model.excludeStopWords
                    , label = I.labelRight [] (E.text "exclude stop words")
                    }
                ]
            ]
        )


clickableQuery : String -> Msg -> E.Element Msg
clickableQuery label msg =
    column [ E.width E.fill ]
        [ I.button
            [ padding 10
            , E.focused [ F.color vividViolet ]
            , E.mouseOver [ F.color vividViolet ]
            , F.size 24
            ]
            { onPress = Just msg
            , label = E.text label
            }
        ]


exampleList : E.Element Msg
exampleList =
    el [ E.width E.fill, E.paddingXY 250 0, E.centerX, F.family [ F.typeface "Helvetica Neue" ] ]
        (column []
            (List.map (\( l, m ) -> clickableQuery l (OnExampleClicked m))
                [ ( "words in commit messages in the last 4 months"
                  , { query = "repo:sourcegraph/sourcegraph$ content:output((\\w+) -> $1) type:commit after:\"4 months ago\" count:all"
                    , visualKind = BarChart
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "changelog entries for lines containing any of 'fixed', 'added', 'removed', 'changed'"
                  , { query = "repo:sourcegraph/sourcegraph$ file:CHANGELOG case:no content:output(- .*(fixed|added|removed|changed).* -> $1) patterntype:regexp"
                    , visualKind = BarChart
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = False
                    }
                  )
                , ( "most common Go var declaration names"
                  , { query = "repo:sourcegraph/sourcegraph$ file:.go content:output(var (\\w+) -> $1) patterntype:regexp"
                    , visualKind = BarChart
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "most common Go variable names in for loops"
                  , { query = "repo:sourcegraph/sourcegraph$ file:.go content:output(for (\\w+), (\\w+) -> $1,$2) patterntype:regexp"
                    , visualKind = BarChart
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "most common functions from Go strings package used"
                  , { query = "repo:sourcegraph/sourcegraph$ file:.go content:output.structural(strings.:[x.] -> :[x.]) patterntype:structural count:1000"
                    , visualKind = Table
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "Go objects with most methods"
                  , { query = "repo:sourcegraph/sourcegraph$ file:.go content:output(func \\(\\w+ (\\w+)\\) -> $1) patterntype:regexp"
                    , visualKind = Table
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "Go files with the most function declarations, excluding tests and mocks"
                  , { query = "repo:sourcegraph/sourcegraph$ -file:test -file:mock lang:go content:output(func -> $path) patterntype:regexp"
                    , visualKind = Table
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "Who works on permissions (commits containing permission in message)"
                  , { query = "repo:sourcegraph/sourcegraph$ content:output((.|\\n)*permission(.|\\n)* -> $author) type:commit after:\"\" count:all"
                    , visualKind = BarChart
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "Teammates who recently worked on code intel"
                  , { query = "repo:sourcegraph/sourcegraph$ content:output(.*codeintel.* -> $date $author) type:commit count:all"
                    , visualKind = BarChart
                    , sortByCount = False
                    , reverse = True
                    , excludeStopWords = True
                    }
                  )
                , ( "Most common commit subjects"
                  , { query = "repo:sourcegraph/sourcegraph$ content:output(^(\\w+): -> $1) type:commit count:all"
                    , visualKind = BarChart
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "Commit graph (by day)"
                  , { query = "repo:sourcegraph/sourcegraph$ content:output((.|\\n)* -> $date) type:commit count:all"
                    , visualKind = BarChart
                    , sortByCount = False
                    , reverse = True
                    , excludeStopWords = True
                    }
                  )
                , ( "Regexp search-replace for file:parser.go (no diff preview available for this, you will only see modified content, sorry!)"
                  , { query = "repo:sourcegraph/sourcegraph$ file:parser.go content:replace(Parse -> derp) patterntype:regexp count:1000"
                    , visualKind = PlainData
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = False
                    }
                  )
                , ( "Color palette from hex codes"
                  , { query = "repo:sourcegraph/sourcegraph file: content:output(#([a-fA-F0-9]{6})[^a-fA-F0-9] -> $1)"
                    , visualKind = ColorPalette
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                , ( "🚨 HEAVY 🚨 Generate word trigram model for 200 Go files (lol yes I'm serious). LIMITED TO 200 FILES FOR STABILITY"
                  , { query = "repo:sourcegraph/sourcegraph$ -file:mock file:.go content:output((\\w+) (\\w+) (\\w+) -> $1 $2 $3) patterntype:regexp count:200"
                    , visualKind = Table
                    , sortByCount = True
                    , reverse = False
                    , excludeStopWords = True
                    }
                  )
                ]
            )
        )



-- DATA LOGIC


parseResults : List Types.Result -> List String
parseResults l =
    List.filterMap
        (\r ->
            case r of
                Output v ->
                    String.split "\n" v.value
                        |> List.filter (not << String.isEmpty)
                        |> Just

                ReplaceInPlace v ->
                    Just [ v.value ]
        )
        l
        |> List.concat


updateChartData : String -> Dict String DataValue -> Dict String DataValue
updateChartData textResult d =
    Dict.update
        textResult
        (\v ->
            case v of
                Nothing ->
                    Just (ViewData.newDataValue textResult)

                Just existing ->
                    Just { existing | value = existing.update existing.value 1 }
        )
        d
