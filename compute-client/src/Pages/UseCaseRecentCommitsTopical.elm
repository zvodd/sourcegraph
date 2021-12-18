module Pages.UseCaseRecentCommitsTopical exposing (Model, Msg, page)

import Effect exposing (Effect)
import Element exposing (..)
import Gen.Params.UseCaseCodeOwnershipTopical exposing (Params)
import Page
import Pages.UseCaseBase exposing (Msg(..))
import Process
import Request
import Shared exposing (Msg)
import Styling exposing (..)
import Task
import Types exposing (..)
import View exposing (View)



-- INIT


init : ( Model, Effect Msg )
init =
    let
        ( model, _ ) =
            Pages.UseCaseBase.init

        topicValue =
            ""

        afterValue =
            ""
    in
    ( { model
        | title = "Code ownership & activity by topic"
        , description = "Find teammates who work on these topics"
        , query = "repo:sourcegraph/sourcegraph$ content:output((" ++ topicValue ++ ") -> $author) type:commit count:all " ++ "after:\"" ++ afterValue ++ "\""
        , genericInput1 = topicValue
        , genericInput2 = afterValue
        , visualKind = BarChart
        , supportedVisualKinds = [ BarChart, Table ]
        , sortByCount = False
        , reverse = True
      }
    , Effect.none
    )


page : Shared.Model -> Request.With Params -> Page.With Model Msg
page _ _ =
    Page.advanced
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }



-- MODEL


type alias Model =
    Pages.UseCaseBase.Model



-- UPDATE


type alias Msg =
    Pages.UseCaseBase.Msg


update : Msg -> Model -> ( Model, Effect Msg )
update msg model =
    let
        debounceQueryMillis =
            400
    in
    case msg of
        OnGenericInput1 genericInput1 ->
            let
                topicValue =
                    "(.|\\n)*" ++ String.join "(.|\\n)*|(.|\\n)*" (List.map String.trimLeft (String.split "," genericInput1)) ++ "(.|\\n)*"

                afterValue =
                    model.genericInput2
            in
            ( { model
                | genericInput1 = genericInput1
                , query = "repo:sourcegraph/sourcegraph$ content:output((" ++ topicValue ++ ") -> $date) type:commit count:all " ++ "after:\"" ++ afterValue ++ "\""
                , debounce = model.debounce + 1
                , queryModifiedSinceLastRequest = True
              }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        OnGenericInput2 genericInput2 ->
            let
                topicValue =
                    "(.|\\n)*" ++ String.join "(.|\\n)*|(.|\\n)*" (List.map String.trimLeft (String.split "," model.genericInput1)) ++ "(.|\\n)*"

                afterValue =
                    genericInput2
            in
            ( { model
                | genericInput2 = genericInput2
                , query = "repo:sourcegraph/sourcegraph$ content:output((" ++ topicValue ++ ") -> $date) type:commit count:all " ++ "after:\"" ++ afterValue ++ "\""
                , debounce = model.debounce + 1
                , queryModifiedSinceLastRequest = True
              }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        _ ->
            Pages.UseCaseBase.update msg model



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions =
    Pages.UseCaseBase.subscriptions



-- VIEW


view : Model -> View Msg
view model =
    Pages.UseCaseBase.view model "topics" "time frame"
