port module Main exposing (..)

import Json.Decode as Decode exposing (Decoder, fail, field, maybe, string)
import Json.Decode.Pipeline
import Browser exposing (UrlRequest)
import Browser.Events exposing (onKeyDown)
import Browser.Navigation as Navigation exposing (Key)
import Chart as C
import Chart.Attributes as CA
import Dict exposing (Dict)
import Element as E
import Element.Background as Background
import Element.Border as Border
import Element.Events
import Element.Font as F
import Element.Input as I
import Html exposing (Html, code, input, pre, text)
import Html.Attributes exposing (..)
import Json.Decode as Decode
import Svg as S
import Svg.Attributes as SA
import Task
import Time
import Url exposing (Url)
import Url.Builder
import Url.Parser exposing (..)
import Url.Parser.Query as QueryParser



-- CONSTANTS


width : Int
width =
    800


delayCheckTick : Float
delayCheckTick =
    200


delayComputeRequest : Int
delayComputeRequest =
    -- AKA query debounce time
    400


endpoint : String
endpoint =
    "https://sourcegraph.test:3443/.api"



-- MAIN


main : Program () Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }



-- MODEL


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


type alias Model =
    { -- User inputs
      query : String
    , dataPoints : Int
    , sortByCount : Bool
    , reverse : Bool
    , excludeStopWords : Bool
    , selectedTab : Tab

    -- State changes
    , queryModifiedSinceLastRequest : Bool
    , millisSinceChange : Int

    -- Data
    , resultsRaw : List Result
    , resultsMap : Dict String DataValue

    -- Debug client only
    , serverless : Bool
    }


init : () -> ( Model, Cmd Msg )
init _ =
    ( { query = "repo:.* content:output((.|\\n)* -> $date) type:commit count:all"
      , dataPoints = 30
      , sortByCount = True
      , reverse = False
      , excludeStopWords = False
      , selectedTab = Chart
      , queryModifiedSinceLastRequest = False
      , millisSinceChange = 0
      , resultsRaw = []
      , resultsMap = Dict.empty
      , serverless = False
      }
    , Task.perform identity (Task.succeed RunCompute)
    )


parseQueryInUrl : Url -> String
parseQueryInUrl url =
    case Url.Parser.parse (top <?> QueryParser.string "q") url of
        Just (Just query) ->
            query

        _ ->
            ""



-- PORTS


type alias RawEvent =
    { data : String
    , eventType : Maybe String
    , id : Maybe String
    }


port receiveEvent : (RawEvent -> msg) -> Sub msg


port openStream : ( String, Maybe String ) -> Cmd msg



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ receiveEvent eventDecoder
        , Time.every delayCheckTick CheckTick
        , onKeyDown keyDecoder
        ]


eventDecoder : RawEvent -> Msg
eventDecoder event =
    case event.eventType of
        Just "results" ->
            OnResults (resultEventDecoder event.data)

        Just "done" ->
            ResultStreamDone

        Just e ->
            NoOp

        Nothing ->
            NoOp


resultEventDecoder : String -> List Result
resultEventDecoder input =
    case Decode.decodeString (Decode.list resultDecoder) input of
        Ok results ->
            results

        Err e ->
            []


keyDecoder : Decode.Decoder Msg
keyDecoder =
    Decode.map toKey (Decode.field "key" Decode.string)


toKey : String -> Msg
toKey keyValue =
    case String.uncons keyValue of
        Just ( char, "" ) ->
            CharacterKey char

        _ ->
            ControlKey keyValue



-- UPDATE


type Msg
    = -- User inputs
      OnQueryChanged String
    | OnDataPoints String
    | OnSortByCheckbox Bool
    | OnReverseCheckbox Bool
    | OnExcludeStopWordsCheckbox Bool
    | OnTabSelected Tab
      -- State and navigation changes
    | UpdateTick Time.Posix
    | CheckTick Time.Posix
      -- Data processing
    | RunCompute
    | OnResults (List Result)
    | ResultStreamDone
    | NoOp
      -- Unused input triggers
    | CharacterKey Char
    | ControlKey String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        OnQueryChanged newQuery ->
            ( { model | query = newQuery, queryModifiedSinceLastRequest = True }
            , Task.perform UpdateTick Time.now
            )

        OnSortByCheckbox sortByCount ->
            ( { model | sortByCount = sortByCount }, Cmd.none )

        OnReverseCheckbox reverse ->
            ( { model | reverse = reverse }, Cmd.none )

        OnExcludeStopWordsCheckbox excludeStopWords ->
            ( { model | excludeStopWords = excludeStopWords }, Cmd.none )

        OnDataPoints i ->
            let
                updateN =
                    case String.toInt i of
                        Just newN ->
                            newN

                        Nothing ->
                            0
            in
            ( { model | dataPoints = updateN }, Cmd.none )

        OnTabSelected selectedTab ->
            ( { model | selectedTab = selectedTab }, Cmd.none )

        UpdateTick time ->
            ( { model | millisSinceChange = Time.posixToMillis time }, Cmd.none )

        CheckTick time ->
            if Time.posixToMillis time - model.millisSinceChange > delayComputeRequest && model.queryModifiedSinceLastRequest then
                update RunCompute model

            else
                ( model, Cmd.none )

        RunCompute ->
            if model.serverless then
                ( { model | resultsRaw = [], resultsMap = exampleResultsMap }, Cmd.none )

            else
                ( { model | queryModifiedSinceLastRequest = False, resultsRaw = [], resultsMap = Dict.empty }
                , openStream ( endpoint ++ Url.Builder.absolute [ "compute", "stream" ] [ Url.Builder.string "q" model.query ], Nothing )
                )

        OnResults r ->
            ( { model
                | resultsRaw = [] -- model.resultsRaw ++ r
                , resultsMap =
                    -- Aggregate in dictionary
                    parseResults r
                        |> List.foldl updateChartData model.resultsMap
              }
            , Cmd.none
            )

        ResultStreamDone ->
            ( model, Cmd.none )

        ControlKey _ ->
            ( model, Cmd.none )

        CharacterKey _ ->
            ( model, Cmd.none )

        NoOp ->
            ( model, Cmd.none )



-- VIEW

table : List DataValue -> E.Element Msg
table data =
    let
        headerAttrs =
            [ F.bold
            , F.size 12
            , F.color darkModeFontColor
            , E.padding 5
            , Border.widthEach { bottom = 1, top = 0, left = 0, right = 0 }
            ]
    in
    E.el [ E.padding 100, E.centerX ] <|
        E.table [ E.width E.fill ]
            { data = data
            , columns =
                [ { header = E.el headerAttrs <| E.text " "
                  , width = E.fillPortion 2
                  , view = \v -> E.el [ E.padding 5 ] (E.el [ E.width E.fill, E.padding 10, Border.rounded 5, Border.width 1 ] (E.text v.name))
                  }
                , { header = E.el (headerAttrs ++ [ F.alignRight ]) <| E.text "Count"
                  , width = E.fillPortion 1
                  , view =
                        \v ->
                            E.el
                                [ E.centerY
                                , F.size 12
                                , F.color darkModeFontColor
                                , F.alignRight
                                , E.padding 5
                                ]
                                (E.text <| String.fromFloat <| v.value)
                  }
                ]
            }


histogram : List DataValue -> E.Element Msg
histogram data =
    let
        ( fontSize, moveDown ) =
            case data of
                [] ->
                    ( 14, 15 )

                { value } :: _ ->
                    if value >= 10000 then
                        ( 11, 15 )

                    else if value >= 1000 then
                        ( 13, 15 )

                    else if value >= 100 then
                        ( 15, 18 )

                    else
                        ( 17, 18 )
    in
    E.el
        [ E.width E.fill
        , E.height (E.fill |> E.minimum 400)
        , E.centerX
        , E.alignTop
        , E.padding 30
        ]
        (E.html <|
            C.chart
                [ CA.height 300, CA.width (toFloat width) ]
                [ C.bars
                    [ CA.spacing 0.0 ]
                    [ C.bar .value [ CA.color "#A112FF", CA.roundTop 0.2 ] ]
                    data
                , C.binLabels .name [ CA.moveDown 25, CA.rotate 45, CA.alignRight ]
                , C.barLabels [ CA.moveDown 12, CA.color "white", CA.fontSize 12 ]
                , C.eachBar <|
                    \p b ->
                        [ C.svg <|
                            \_ ->
                                S.svg []
                                    [ S.a
                                        [ SA.xlinkHref "https://elm-lang.org" ]
                                        [ S.g [ SA.fill "transparent" ]
                                            -- TODO stretch this to the bar
                                            [ S.rect [ SA.width "100", SA.height "100" ] []
                                            , S.text_ [ SA.y "50", SA.fill "none" ] [ S.text "qux" ]
                                            ]
                                        ]
                                    ]
                        ]
                ]
        )


dataView : List DataValue -> E.Element Msg
dataView data =
    E.row []
        [ E.el [ E.padding 10, E.alignLeft, E.width E.fill ]
            (E.column [] (List.map (\d -> E.text d.name) data))
        ]


inputRow : Model -> E.Element Msg
inputRow model =
    E.el [ E.centerX, E.width E.fill ]
        (E.column [ E.width E.fill ]
            [ I.text [ Background.color darkModeTextInputColor ]
                { onChange = OnQueryChanged
                , placeholder = Nothing
                , text = model.query
                , label = I.labelHidden ""
                }
            , E.row [ E.paddingXY 0 10 ]
                [ I.text [ E.width (E.fill |> E.maximum 65), F.center, Background.color darkModeTextInputColor ]
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
                , I.checkbox [ E.paddingXY 10 0 ]
                    { onChange = OnSortByCheckbox
                    , icon = I.defaultCheckbox
                    , checked = model.sortByCount
                    , label = I.labelRight [] (E.text "sort by count")
                    }
                , I.checkbox [ E.paddingXY 10 0 ]
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


type Tab
    = Chart
    | Table
    | Data


color =
    { skyBlue = E.rgb255 0x00 0xCB 0xEC
    , vividViolet = E.rgb255 0xA1 0x12 0xFF
    , vermillion = E.rgb255 0xFF 0x55 0x43
    }


tab : Tab -> Tab -> E.Element Msg
tab thisTab selectedTab =
    let
        isSelected =
            thisTab == selectedTab

        padOffset =
            if isSelected then
                0

            else
                2

        borderWidths =
            if isSelected then
                { left = 1, top = 1, right = 1, bottom = 0 }

            else
                { bottom = 1, top = 0, left = 0, right = 0 }

        corners =
            if isSelected then
                { topLeft = 6, topRight = 6, bottomLeft = 0, bottomRight = 0 }

            else
                { topLeft = 0, topRight = 0, bottomLeft = 0, bottomRight = 0 }

        tabColor =
            case selectedTab of
                Chart ->
                    color.vividViolet

                Table ->
                    color.vermillion

                Data ->
                    color.skyBlue

        text =
            case thisTab of
                Chart ->
                    "Chart"

                Table ->
                    "Table"

                Data ->
                    "Data"
    in
    E.el
        [ Border.widthEach borderWidths
        , Border.roundEach corners
        , Border.color tabColor
        , Element.Events.onClick <| OnTabSelected thisTab
        , E.htmlAttribute <| Html.Attributes.style "cursor" "pointer"
        , E.width E.fill
        ]
    <|
        E.el
            [ E.centerX
            , E.width E.fill
            , E.centerY
            , E.paddingEach { left = 30, right = 30, top = 10 + padOffset, bottom = 10 - padOffset }
            ]
            (E.text text)


outputRow : Tab -> E.Element Msg
outputRow selectedTab =
    E.row [ E.centerX, E.width E.fill ]
        [ tab Chart selectedTab
        , tab Table selectedTab
        , tab Data selectedTab
        ]


view : Model -> Html Msg
view model =
    E.layout
        [ E.width E.fill
        , F.family [ F.typeface "Fira Code" ]
        , F.size 12
        , F.color darkModeFontColor
        , Background.color darkModeBackgroundColor
        ]
        (E.row [ E.centerX, E.width (E.fill |> E.maximum width) ]
            [ E.column [ E.centerX, E.width (E.fill |> E.maximum width), E.paddingXY 20 20 ]
                [ inputRow model
                , outputRow model.selectedTab
                , case model.selectedTab of
                    Chart ->
                        Dict.toList model.resultsMap
                            |> List.map Tuple.second
                            |> filterData model
                            |> histogram

                    Table ->
                        Dict.toList model.resultsMap
                            |> List.map Tuple.second
                            |> filterData model
                            |> table

                    Data ->
                        Dict.toList model.resultsMap
                            |> List.map Tuple.second
                            |> filterData model
                            |> dataView
                ]
            ]
        )



-- DATA LOGIC


parseResults : List Result -> List String
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


newDataValue : String -> DataValue
newDataValue textResult =
    case String.split "@@@" textResult of
        -- XXX magic string
        [] ->
            { name = textResult, value = 1, update = (+) }

        [ _ ] ->
            { name = textResult, value = 1, update = (+) }

        name :: floatValue :: [] ->
            case String.toFloat floatValue of
                Just value ->
                    { name = name, value = value, update = \_ _ -> value }

                Nothing ->
                    -- Never
                    { name = textResult, value = 1, update = (+) }

        _ ->
            -- Never
            { name = textResult, value = 1, update = (+) }


updateChartData : String -> Dict String DataValue -> Dict String DataValue
updateChartData textResult d =
    Dict.update
        textResult
        (\v ->
            case v of
                Nothing ->
                    Just (newDataValue textResult)

                Just existing ->
                    Just { existing | value = existing.update existing.value 1 }
        )
        d


filterData : Filter a -> List DataValue -> List DataValue
filterData { dataPoints, sortByCount, reverse, excludeStopWords } data =
    let
        pipeSort =
            if sortByCount then
                List.sortWith
                    (\l r ->
                        if l.value < r.value then
                            GT

                        else if l.value > r.value then
                            LT

                        else
                            EQ
                    )

            else
                identity
    in
    let
        pipeReverse =
            if reverse then
                List.reverse

            else
                identity
    in
    let
        pipeStopWords =
            if excludeStopWords then
                List.filter (\{ name } -> not (Dict.member (String.toLower name) Dict.empty))

            else
                identity
    in
    data
        |> pipeStopWords
        |> pipeSort
        |> pipeReverse
        |> List.take dataPoints
        |> pipeReverse


exampleResultsMap : Dict String DataValue
exampleResultsMap =
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


darkModeBackgroundColor : E.Color
darkModeBackgroundColor =
    E.rgb255 0x18 0x1B 0x26


darkModeFontColor : E.Color
darkModeFontColor =
    E.rgb255 0xFF 0xFF 0xFF


darkModeTextInputColor : E.Color
darkModeTextInputColor =
    E.rgb255 0x1D 0x22 0x2F





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
    field "kind" Decode.string
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
        |> Json.Decode.Pipeline.required "value" Decode.string
        |> Json.Decode.Pipeline.optional "repository" (maybe Decode.string) Nothing
        |> Json.Decode.Pipeline.optional "commit" (maybe Decode.string) Nothing
        |> Json.Decode.Pipeline.optional "path" (maybe Decode.string) Nothing