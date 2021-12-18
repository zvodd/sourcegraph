module Pages.UseCaseBase exposing (Model, Msg(..), init, inputRow, page, subscriptions, update, view)

import Dict exposing (Dict)
import Effect exposing (Effect)
import Element as E exposing (..)
import Element.Font as F
import Element.Input as I
import ExampleData
import Gen.Params.UseCaseBase exposing (Params)
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
        , view = \m -> view m "generic input 1" "generic input 2"
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


type alias Model =
    { -- User inputs : data
      title : String
    , description : String
    , query : String
    , genericInput1 : String
    , genericInput2 : String

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
    ( { title = "Base use case"
      , description = "Description"
      , query = "repo:sourcegraph/sourcegraph content:output(#([a-fA-F0-9]{6})[^a-fA-F0-9] -> $1)"
      , genericInput1 = "" -- a generic input inserted in the query depending on use case. See specific use cases for contextual names.
      , genericInput2 = "" -- a second generic input inserted in the query depending on use case. See specific use cases for contextual names.
      , visualKind = BarChart -- default visual
      , supportedVisualKinds = [ BarChart, Table ] -- visual tabs this data supports

      -- data filtering
      , dataPoints = 30 -- how many data points to show
      , sortByCount = True -- whether to sort data by aggregate ordinal value (number of times we saw the value); if false, sort lexicographically by value instead
      , reverse = False -- whether to reverse the sorted data
      , excludeStopWords = True -- whether to remove values that are stop words

      -- page data and app state
      , resultsMap = Dict.empty
      , resultsRaw = []
      , queryModifiedSinceLastRequest = False
      , millisSinceChange = 0
      , debounce = 0
      , serverless = False
      }
    , Effect.fromCmd (Task.perform identity (Task.succeed RunCompute))
    )



-- UPDATE


type Msg
    = OnQueryChanged String
    | OnGenericInput1 String
    | OnGenericInput2 String
    | OnDataPoints String
    | OnSortByCheckbox Bool
    | OnReverseCheckbox Bool
    | OnExcludeStopWordsCheckbox Bool
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

        OnGenericInput1 genericInput1 ->
            ( { model | genericInput1 = genericInput1 }, Effect.none )

        OnGenericInput2 genericInput2 ->
            ( { model | genericInput2 = genericInput2 }, Effect.none )

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

        NoOp ->
            ( model, Effect.none )



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ Stream.receiveEvent eventDecoder
        ]


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


view : Model -> String -> String -> View Msg
view model genericInputPlaceholder1 genericInputPlaceholder2 =
    { title = model.title
    , element =
        column [ E.width E.fill, E.paddingXY 200 100 ]
            [ el [ E.paddingXY 0 20, F.size 48, F.family [ F.typeface "Helvetica Neue" ] ] (text model.title)
            , el
                [ E.paddingEach { top = 0, right = 0, left = 0, bottom = 60 }
                , F.size 36
                , F.family [ F.typeface "Helvetica Neue" ]
                ]
                (text model.description)
            , row []
                [ el [ E.paddingXY 0 20 ]
                    (I.text [ width (fill |> minimum 400) ]
                        { onChange = OnGenericInput1
                        , placeholder = Just (I.placeholder [] (text genericInputPlaceholder1))
                        , text = model.genericInput1
                        , label = I.labelHidden ""
                        }
                    )
                , if String.isEmpty genericInputPlaceholder2 then
                    E.none

                  else
                    el [ E.paddingXY 0 20, E.paddingXY 20 0 ]
                        (I.text [ width (fill |> minimum 400) ]
                            { onChange = OnGenericInput2
                            , placeholder = Just (I.placeholder [] (text genericInputPlaceholder2))
                            , text = model.genericInput2
                            , label = I.labelHidden ""
                            }
                        )
                ]
            , ViewData.tabbedView
                model.supportedVisualKinds
                OnTabSelected
                model.visualKind
                model
                model.resultsMap
            , el [ E.width E.fill, E.paddingXY 0 420, E.centerX ] (inputRow model)
            ]
    }


inputRow : Model -> E.Element Msg
inputRow model =
    el [ E.width E.fill, centerX, padding 20 ]
        (column [ width (fill |> minimum 1400) ]
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
